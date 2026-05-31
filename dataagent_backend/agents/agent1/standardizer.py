"""
agents/agent1/standardizer.py
==============================
Product name standardization engine for Screen 3.

Pipeline (in order):
  1. Synonym normalisation — uses synonym_config.json (fast, no API call)
  2. Rule-based cleanup   — abbreviation expansion, title-casing, noise removal
  3. LLM taxonomy parse   — calls TaxonomyAgent (Groq/Anthropic) when api_key provided
     and confidence after steps 1+2 is below 80.

Stores results in `standardized_products` table.
Manual overrides are saved with status='overridden'.
"""

import re
import json
import sqlite3
import logging
import io
import os
from pathlib import Path
from typing import Optional

import pandas as pd

from agents.agent1.mapping import detect_platform

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
DB_PATH           = str(Path(__file__).resolve().parent.parent.parent / "dataagent.db")
SYNONYM_CFG_PATH  = Path(__file__).resolve().parent / "synonym_config.json"

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

def _resolve_file_path(stored_path: str, filename: str):
    """Resolve upload path even if the stored path is stale/from another machine."""
    import glob
    if stored_path and os.path.exists(stored_path):
        return stored_path
    if stored_path:
        candidate = UPLOADS_DIR / os.path.basename(stored_path)
        if candidate.exists():
            return str(candidate)
    if filename:
        matches = glob.glob(str(UPLOADS_DIR / f"*{filename}"))
        if matches:
            return matches[0]
    return None


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_standardize_table():
    """
    Create standardized_products table. Safe to call repeatedly.
    UNIQUE on original_name only — one canonical row per unique product name
    regardless of how many files or platforms it appears in.
    occurrence_count tracks how many rows across all uploads share this name.
    """
    conn = _get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS standardized_products (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name     TEXT    NOT NULL UNIQUE,
                standardized_name TEXT    NOT NULL,
                confidence        INTEGER NOT NULL DEFAULT 0,
                platform          TEXT    NOT NULL DEFAULT 'Unknown',
                status            TEXT    NOT NULL DEFAULT 'auto',
                occurrence_count  INTEGER NOT NULL DEFAULT 1
            )
        """)
        # Migrate old schema if it exists with upload_id column
        try:
            conn.execute("ALTER TABLE standardized_products ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1")
        except Exception:
            pass  # column already exists
        conn.commit()
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Synonym config loader
# ─────────────────────────────────────────────────────────────────────────────
def _load_synonym_config() -> dict:
    if not SYNONYM_CFG_PATH.exists():
        logger.warning(f"synonym_config.json not found at {SYNONYM_CFG_PATH}")
        return {}
    try:
        with open(SYNONYM_CFG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load synonym_config.json: {e}")
        return {}

_SYNONYM_CFG = _load_synonym_config()

def _build_reverse_map(section: dict) -> dict[str, str]:
    """Turn {canonical: [alias, ...]} into {alias_lower: canonical}.
    Skips keys starting with '_' (used as JSON comments/metadata) and
    any entry whose value is not a list."""
    rev = {}
    for canonical, aliases in section.items():
        if canonical.startswith("_") or not isinstance(aliases, list):
            continue
        for alias in aliases:
            rev[str(alias).lower()] = canonical
    return rev

_BRAND_MAP     = _build_reverse_map(_SYNONYM_CFG.get("brand", {}))
_CATEGORY_MAP  = _build_reverse_map(_SYNONYM_CFG.get("main_category", {}))
_SUBTYPE_MAP   = _build_reverse_map(_SYNONYM_CFG.get("sub_type", {}))
_CONTAINER_MAP = _build_reverse_map(_SYNONYM_CFG.get("container", {}))
_UNIT_MAP      = _build_reverse_map(_SYNONYM_CFG.get("unit", {}))

# Forward maps: canonical name → True  (for quick "is this already canonical?" checks)
# Exclude '_'-prefixed metadata keys from the synonym config
_BRAND_CANONICAL     = {k for k in _SYNONYM_CFG.get("brand", {})         if not k.startswith("_")}
_CATEGORY_CANONICAL  = {k for k in _SYNONYM_CFG.get("main_category", {}) if not k.startswith("_")}
_SUBTYPE_CANONICAL   = {k for k in _SYNONYM_CFG.get("sub_type", {})      if not k.startswith("_")}
_CONTAINER_CANONICAL = {k for k in _SYNONYM_CFG.get("container", {})     if not k.startswith("_")}
_UNIT_CANONICAL      = {k for k in _SYNONYM_CFG.get("unit", {})          if not k.startswith("_")}


def _snap_field_to_synonym(value: Optional[str], reverse_map: dict, canonical_set: set) -> Optional[str]:
    """
    If `value` is already a canonical form, return it as-is.
    If `value` (lowered) matches an alias in reverse_map, return the canonical form.
    Otherwise return None (no synonym match).
    """
    if not value:
        return None
    if value in canonical_set:
        return value
    return reverse_map.get(value.lower().strip())


def snap_taxonomy_to_synonyms(taxonomy: dict) -> dict:
    """
    Post-validate an LLM taxonomy dict by snapping each field to the nearest
    synonym_config canonical form.  Modifies in-place and returns the dict.
    """
    snapped_brand = _snap_field_to_synonym(taxonomy.get("brand"), _BRAND_MAP, _BRAND_CANONICAL)
    if snapped_brand:
        taxonomy["brand"] = snapped_brand

    snapped_cat = _snap_field_to_synonym(taxonomy.get("main_category"), _CATEGORY_MAP, _CATEGORY_CANONICAL)
    if snapped_cat:
        taxonomy["main_category"] = snapped_cat

    snapped_sub = _snap_field_to_synonym(taxonomy.get("sub_type"), _SUBTYPE_MAP, _SUBTYPE_CANONICAL)
    if snapped_sub:
        taxonomy["sub_type"] = snapped_sub

    snapped_ctr = _snap_field_to_synonym(taxonomy.get("container"), _CONTAINER_MAP, _CONTAINER_CANONICAL)
    if snapped_ctr:
        taxonomy["container"] = snapped_ctr

    snapped_unit = _snap_field_to_synonym(taxonomy.get("unit"), _UNIT_MAP, _UNIT_CANONICAL)
    if snapped_unit:
        taxonomy["unit"] = snapped_unit

    return taxonomy


def generate_synonym_suggestion(product_name: str, platform: str = None) -> dict:
    """
    Build a standardized suggestion using ONLY the synonym_config.json vocabulary.
    No LLM call, no API key required.

    Strategy:
      1. Pre-process: for long Amazon-style titles, extract the meaningful prefix
         before the first '|' pipe separator.
      2. Tokenize and do multi-word window matching (3-word, 2-word, 1-word)
         against each reverse map.
      3. Extract size+unit via regex.
      4. Apply container defaults: first from sub_type_container_defaults,
         then from platform_container_defaults.
    Returns {standardized_name, confidence, taxonomy}.
    """
    if not product_name or not product_name.strip():
        return {
            "standardized_name": product_name,
            "confidence": 0,
            "taxonomy": {
                "brand": None, "main_category": None, "sub_type": None,
                "size": None, "unit": None, "container": None, "confidence": 0.0,
            },
        }

    raw_text = product_name.strip()

    # ── Pre-process long titles (Amazon-style: useful info | marketing fluff) ─
    # Use the full text for matching but focus on the first segment for primary
    # info.  We match across the full text so "5L Can" in a later segment is found.
    # Also extract explicit container mentions from ALL segments.
    segments = [s.strip() for s in raw_text.split("|")]
    primary_segment = segments[0] if segments else raw_text

    # Combine primary segment + any short secondary segments for matching
    # (skip long marketing blurbs)
    match_text = primary_segment
    for seg in segments[1:]:
        # Only include short segments that might contain size/container info
        if len(seg.split()) <= 8:
            match_text += " " + seg

    words = match_text.split()

    # ── Match each field using sliding window over tokens ─────────────────
    field_maps = [
        (_BRAND_MAP,     _BRAND_CANONICAL,     "brand"),
        (_CATEGORY_MAP,  _CATEGORY_CANONICAL,  "main_category"),
        (_SUBTYPE_MAP,   _SUBTYPE_CANONICAL,   "sub_type"),
        (_CONTAINER_MAP, _CONTAINER_CANONICAL,  "container"),
    ]

    results = {"brand": None, "main_category": None, "sub_type": None, "container": None}

    for rev_map, canon_set, field_name in field_maps:
        best_match = None
        best_window = 0
        # Try longest window first for best specificity
        for window in [3, 2, 1]:
            for i in range(len(words) - window + 1):
                phrase = " ".join(words[i:i+window]).lower()
                if phrase in rev_map:
                    if window > best_window:
                        best_match = rev_map[phrase]
                        best_window = window
                # Also check if the phrase IS a canonical name (case-insensitive)
                for canon in canon_set:
                    if canon.lower() == phrase and window > best_window:
                        best_match = canon
                        best_window = window
        if best_match:
            results[field_name] = best_match

    # ── Also scan the FULL raw text for container mentions (e.g. "5L Can") ───
    if not results["container"]:
        full_words = raw_text.split()
        for window in [2, 1]:
            for i in range(len(full_words) - window + 1):
                phrase = " ".join(full_words[i:i+window]).lower()
                if phrase in _CONTAINER_MAP:
                    results["container"] = _CONTAINER_MAP[phrase]
                    break
                for canon in _CONTAINER_CANONICAL:
                    if canon.lower() == phrase:
                        results["container"] = canon
                        break
                if results["container"]:
                    break
            if results["container"]:
                break

    # ── Extract size + unit via regex (scan full raw text) ────────────────
    size_val = None
    unit_val = None
    unit_keys = sorted(_UNIT_MAP.keys(), key=len, reverse=True)
    # Also match canonical units directly (e.g. "1L", "5L", "500ml")
    all_unit_tokens = sorted(
        set(list(_UNIT_MAP.keys()) + list(_UNIT_CANONICAL)),
        key=len, reverse=True,
    )
    unit_pattern = r'(\d+\.?\d*)\s*(' + '|'.join(re.escape(k) for k in all_unit_tokens) + r')\b'
    size_match = re.search(unit_pattern, raw_text, re.IGNORECASE)
    if size_match:
        try:
            size_val = float(size_match.group(1))
        except (ValueError, TypeError):
            size_val = None
        raw_unit = size_match.group(2)
        unit_val = _UNIT_MAP.get(raw_unit.lower(), None)
        if unit_val is None:
            # Check if it's already a canonical unit
            for canon in _UNIT_CANONICAL:
                if canon.lower() == raw_unit.lower():
                    unit_val = canon
                    break
        if unit_val is None:
            unit_val = raw_unit.lower()

    # Also try matching "X Litre" / "X litre" patterns
    if size_val is None:
        litre_match = re.search(r'(\d+\.?\d*)\s*(litre|liter|litres|liters)\b', raw_text, re.IGNORECASE)
        if litre_match:
            try:
                size_val = float(litre_match.group(1))
                unit_val = "l"
            except (ValueError, TypeError):
                pass

    # ── Container defaults from synonym_config ────────────────────────────
    # Priority: explicit match > sub_type default > platform default
    if not results["container"]:
        sub_type_defaults = _SYNONYM_CFG.get("sub_type_container_defaults", {})
        if results["sub_type"] and results["sub_type"] in sub_type_defaults:
            results["container"] = sub_type_defaults[results["sub_type"]]

    if not results["container"] and platform:
        platform_defaults = _SYNONYM_CFG.get("platform_container_defaults", {})
        plat_key = platform.lower().strip()
        default_container = platform_defaults.get(plat_key, platform_defaults.get("_default"))
        if default_container:
            results["container"] = default_container

    # ── Confidence scoring ────────────────────────────────────────────────
    confidence = 0
    if results["brand"]:         confidence += 25
    if results["main_category"]: confidence += 15
    if results["sub_type"]:      confidence += 25
    if results["container"]:     confidence += 10
    if size_val is not None:     confidence += 15
    if unit_val:                 confidence += 10
    confidence = min(100, confidence)

    # ── Build standardized name ───────────────────────────────────────────
    parts = []
    if results["brand"]:
        parts.append(results["brand"])
    if results["sub_type"]:
        parts.append(results["sub_type"])
    if size_val is not None and unit_val:
        size_str = str(int(size_val)) if size_val == int(size_val) else str(size_val)
        parts.append(f"{size_str}{unit_val}")
    if results["container"]:
        parts.append(f"— {results['container']}")

    standardized_name = " ".join(parts) if parts else product_name

    taxonomy = {
        "brand":         results["brand"],
        "main_category": results["main_category"],
        "sub_type":      results["sub_type"],
        "size":          size_val,
        "unit":          unit_val,
        "container":     results["container"],
        "confidence":    round(confidence / 100, 2),
    }

    logger.info(
        f"Synonym suggestion for '{product_name[:60]}...' → '{standardized_name}' ({confidence}%)"
    )

    return {
        "standardized_name": standardized_name,
        "confidence":        confidence,
        "taxonomy":          taxonomy,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Rule-based helpers (kept from original)
# ─────────────────────────────────────────────────────────────────────────────
_ABBREV_MAP = {
    r"\bm\b": "Men's",   r"\bw\b": "Women's",  r"\bu\b": "Unisex",
    r"\bblk\b": "Black", r"\bwht\b": "White",   r"\bred\b": "Red",
    r"\bgrn\b": "Green", r"\bblu\b": "Blue",    r"\bnvl\b": "Navy",
    r"\bsz\b": "Size",   r"\bgb\b": "GB",       r"\btb\b": "TB",
    r"\bcm\b": "cm",     r"\bmm\b": "mm",
    r"\busb-c\b": "USB-C", r"\busbc\b": "USB-C",
    r"\bgen(\d)\b": r"(\1st Gen)",
}

_NOISE_PATTERNS = [
    r"\s*[-|_/]\s*$",
    r"^\s*[-|_/]\s*",
    r"\s{2,}",
]

_KNOWN_BRANDS = {
    "nike", "adidas", "puma", "reebok", "apple", "samsung", "sony", "lg",
    "oneplus", "xiaomi", "realme", "levi's", "levis", "zara", "h&m",
    "dyson", "philips", "boat", "jbl", "bose", "dove", "nivea", "colgate",
    "dettol", "gillette", "pantene", "garnier", "lakme", "maybelline",
    "himalaya", "mamaearth", "patanjali", "dabur", "parachute",
}


def _expand_abbreviations(text: str) -> tuple[str, int]:
    expansions = 0
    for pattern, replacement in _ABBREV_MAP.items():
        new = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        if new != text:
            expansions += 1
        text = new
    return text, expansions


def _clean_noise(text: str) -> tuple[str, int]:
    changes = 0
    for pattern in _NOISE_PATTERNS:
        new = re.sub(pattern, " " if r"\s{2,}" in pattern else "", text).strip()
        if new != text:
            changes += 1
        text = new
    return text.strip(), changes


def _title_case_smart(text: str) -> str:
    words = text.split()
    result = []
    for w in words:
        wl = w.lower()
        if wl in _KNOWN_BRANDS:
            brand_map = {"h&m": "H&M", "levi's": "Levi's", "levis": "Levi's", "lg": "LG"}
            result.append(brand_map.get(wl, w.title()))
        elif re.fullmatch(r"[A-Z0-9][A-Z0-9\-]{1,}", w):
            result.append(w)
        else:
            result.append(w.capitalize())
    return " ".join(result)


# ─────────────────────────────────────────────────────────────────────────────
# Synonym-based normalisation pass
# ─────────────────────────────────────────────────────────────────────────────
def _apply_synonyms(text: str) -> tuple[str, int]:
    """
    Walk through the synonym maps and replace known aliases with canonical forms.
    Returns (normalised_text, bonus_confidence_points).
    """
    bonus = 0
    words = text.split()
    result_words = []

    i = 0
    while i < len(words):
        # Try 3-word, 2-word, 1-word windows (longest match first)
        matched = False
        for window in [3, 2, 1]:
            phrase = " ".join(words[i:i+window]).lower()
            for rev_map, label in [
                (_BRAND_MAP,     "brand"),
                (_SUBTYPE_MAP,   "sub_type"),
                (_CONTAINER_MAP, "container"),
            ]:
                if phrase in rev_map:
                    canonical = rev_map[phrase]
                    result_words.append(canonical)
                    bonus += 12
                    i += window
                    matched = True
                    break
            if matched:
                break
        if not matched:
            result_words.append(words[i])
            i += 1

    # Normalise unit abbreviations inline (e.g. "ML" → "ml", "gm" → "g")
    normalised = " ".join(result_words)
    def _norm_unit(m):
        raw = m.group(1)
        unit_norm = _UNIT_MAP.get(raw.lower(), raw.lower())
        return f"{m.group(0).split(raw)[0]}{unit_norm}"

    unit_pattern = r'(\d+\.?\d*)\s*(' + '|'.join(
        re.escape(k) for k in sorted(_UNIT_MAP.keys(), key=len, reverse=True)
    ) + r')\b'
    def _replace_unit(m):
        num   = m.group(1)
        raw_u = m.group(2)
        canon = _UNIT_MAP.get(raw_u.lower(), raw_u.lower())
        if canon != raw_u:
            return f"{num}{canon}"
        return m.group(0)

    normalised = re.sub(unit_pattern, _replace_unit, normalised, flags=re.IGNORECASE)

    return normalised, bonus


# ─────────────────────────────────────────────────────────────────────────────
# Combined rule-based standardizer (synonym + rules)
# ─────────────────────────────────────────────────────────────────────────────
def standardize_name(raw: str) -> tuple[str, int]:
    """
    Returns (standardized_name, confidence_0_to_100).
    Step 1: synonym normalisation (+12 per synonym hit)
    Step 2: abbreviation expansion (+8 per expansion)
    Step 3: noise removal (+5 per fix)
    Step 4: smart title-case (+10 if changed)
    Step 5: known brand detection (+10)
    Base: 50
    """
    if not isinstance(raw, str) or not raw.strip():
        return raw, 0

    text = raw.strip()
    score = 50

    # 1 — synonyms
    text, syn_bonus = _apply_synonyms(text)
    score += syn_bonus

    # 2 — abbreviations
    text, abbrev_count = _expand_abbreviations(text)
    score += abbrev_count * 8

    # 3 — noise
    text, noise_fixes = _clean_noise(text)
    score += noise_fixes * 5

    # 4 — title case
    titled = _title_case_smart(text)
    if titled != text:
        score += 10
    text = titled

    # 5 — known brand
    lower = text.lower()
    for brand in _KNOWN_BRANDS:
        if lower.startswith(brand):
            score += 10
            break

    # Penalise remaining ALL-CAPS
    all_caps_words = sum(1 for w in text.split() if w.isupper() and len(w) > 2)
    score -= all_caps_words * 8

    confidence = max(0, min(100, score))
    return text, confidence


# ─────────────────────────────────────────────────────────────────────────────
# Public API consumed by the router
# ─────────────────────────────────────────────────────────────────────────────
def run_standardization_for_all() -> int:
    """
    Read all uploads, collect every unique product name across all files,
    standardize each unique name ONCE, and store one row per unique original_name.
    occurrence_count = how many times that name appears across all uploaded data.
    Already-overridden rows are never touched.
    """
    conn_meta = _get_db()
    uploads = conn_meta.execute(
        "SELECT id, filename, file_path, file_type FROM uploads WHERE status = 'uploaded'"
    ).fetchall()
    conn_meta.close()

    # Collect all names: {original_name: (platform, occurrence_count)}
    # If a name appears in multiple files, keep the last platform seen but sum counts
    name_info: dict[str, dict] = {}

    for upload in uploads:
        filename  = upload["filename"]
        file_path = upload["file_path"]
        file_type = upload["file_type"]
        platform  = detect_platform(filename)

        file_path = _resolve_file_path(file_path, filename)
        if not file_path:
            logger.warning(f"File not found for upload: {filename}")
            continue

        try:
            with open(file_path, "rb") as fh:
                contents = fh.read()

            if file_type in ("xlsx", "xls"):
                df = pd.read_excel(io.BytesIO(contents), sheet_name=0)
            elif file_type == "csv":
                try:
                    df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(contents), encoding="latin-1")
            else:
                continue

            df.columns = [str(c).strip() for c in df.columns]
            name_col = _pick_name_column(list(df.columns))
            if name_col is None:
                logger.info(f"No product-name column in {filename}")
                continue

            for raw_name in df[name_col].dropna().astype(str).tolist():
                raw_name = raw_name.strip()
                if not raw_name:
                    continue
                if raw_name in name_info:
                    name_info[raw_name]["count"] += 1
                else:
                    name_info[raw_name] = {"platform": platform, "count": 1}

        except Exception as e:
            logger.error(f"Error reading {filename}: {e}")
            continue

    # Now upsert one row per unique name — skip overridden rows
    # Also collect taxonomy values derived from product names to populate
    # standardized_fields (category / sub_category / brand), since most
    # upload files do not have dedicated sub_category columns.
    init_standardize_fields_table()

    # {(field_type, extracted_value): {platform, count}}
    taxonomy_field_values: dict = {}

    conn = _get_db()
    total = 0
    try:
        for raw_name, info in name_info.items():
            # Check if already overridden — never touch those
            existing = conn.execute(
                "SELECT status FROM standardized_products WHERE original_name = ?",
                (raw_name,)
            ).fetchone()

            if existing and existing["status"] == "overridden":
                # Just update the occurrence count so stats stay accurate
                conn.execute(
                    "UPDATE standardized_products SET occurrence_count = ? WHERE original_name = ?",
                    (info["count"], raw_name)
                )
                total += 1
                # Still extract taxonomy for overridden products so tabs stay populated
            else:
                std_name, confidence = standardize_name(raw_name)
                conn.execute(
                    """
                    INSERT INTO standardized_products
                        (original_name, standardized_name, confidence, platform, status, occurrence_count)
                    VALUES (?, ?, ?, ?, 'auto', ?)
                    ON CONFLICT(original_name)
                    DO UPDATE SET
                        standardized_name = excluded.standardized_name,
                        confidence        = excluded.confidence,
                        platform          = excluded.platform,
                        occurrence_count  = excluded.occurrence_count,
                        status            = 'auto'
                    """,
                    (raw_name, std_name, confidence, info["platform"], info["count"])
                )
                total += 1

            # Extract taxonomy from product name and accumulate field values
            taxonomy_result = generate_synonym_suggestion(raw_name, info["platform"])
            taxonomy = taxonomy_result.get("taxonomy", {})
            extractions = {
                "category":     taxonomy.get("main_category"),
                "sub_category": taxonomy.get("sub_type"),
                "brand":        taxonomy.get("brand"),
            }
            for ftype, fval in extractions.items():
                if not fval:
                    continue
                fval = str(fval).strip()
                if not fval:
                    continue
                key = (ftype, fval)
                if key in taxonomy_field_values:
                    taxonomy_field_values[key]["count"] += info["count"]
                else:
                    taxonomy_field_values[key] = {"platform": info["platform"], "count": info["count"]}

        # Upsert taxonomy-derived field values into standardized_fields
        for (ftype, fval), finfo in taxonomy_field_values.items():
            fld_existing = conn.execute(
                "SELECT status FROM standardized_fields WHERE field_type = ? AND original_value = ?",
                (ftype, fval)
            ).fetchone()
            if fld_existing and fld_existing["status"] == "overridden":
                continue
            std_fval, fconf = standardize_field_value(fval, ftype)
            conn.execute(
                """
                INSERT INTO standardized_fields
                    (field_type, original_value, standardized_value, confidence, platform, status, occurrence_count)
                VALUES (?, ?, ?, ?, ?, 'auto', ?)
                ON CONFLICT(field_type, original_value)
                DO UPDATE SET
                    standardized_value = excluded.standardized_value,
                    confidence         = excluded.confidence,
                    platform           = excluded.platform,
                    occurrence_count   = excluded.occurrence_count,
                    status             = 'auto'
                """,
                (ftype, fval, std_fval, fconf, finfo["platform"], finfo["count"])
            )

        conn.commit()
    finally:
        conn.close()

    logger.info(f"Standardization complete — {total} unique product names processed.")
    return total


def _pick_name_column(columns: list[str]) -> Optional[str]:
    _PRODUCT_COL_KEYWORDS = [
        "product_title", "product_name", "item_name", "item_description",
        "product", "title", "name", "description", "item", "sku_name",
        "sku_description", "product_desc", "product title", "product name",
    ]
    lc = {c.lower().strip(): c for c in columns}
    for kw in _PRODUCT_COL_KEYWORDS:
        if kw in lc:
            return lc[kw]
    for raw, orig in lc.items():
        if "name" in raw or "title" in raw:
            return orig
    return None


def get_all_standardized(
    platform: Optional[str] = None,
    needs_review: bool = False,
) -> list[dict]:
    """
    Return unique standardized product rows.
    Each row is one unique original_name — no duplicates.
    """
    conn = _get_db()
    try:
        query      = "SELECT * FROM standardized_products"
        params: list = []
        conditions: list[str] = []

        if platform:
            conditions.append("LOWER(platform) = LOWER(?)")
            params.append(platform)
        if needs_review:
            conditions.append("confidence < 80")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY confidence ASC, original_name"

        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def override_standardized_name(product_id: int, new_name: str) -> Optional[dict]:
    """
    Update the standardized name for a product by id and mark status='overridden'.
    Because there is now one row per unique original_name, this single UPDATE
    effectively updates the standardized name for every occurrence of this
    product across all uploaded files.
    """
    conn = _get_db()
    try:
        conn.execute(
            """
            UPDATE standardized_products
               SET standardized_name = ?,
                   status            = 'overridden',
                   confidence        = 100
             WHERE id = ?
            """,
            (new_name, product_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM standardized_products WHERE id = ?", (product_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_field_suggestions(value: str, field_type: str) -> list:
    """
    Return synonym-based suggestion chips for brand / category / sub_category.
    Tries three matching strategies and deduplicates results (max 6 suggestions).

    Strategies:
      1. Direct standardize_field_value() — best/exact synonym match
      2. Canonical set word-overlap scan — canonicals that share words with `value`
      3. Reverse map prefix/substring scan — aliases that partially match `value`
    """
    cfg = FIELD_CONFIG.get(field_type)
    if not cfg or not value or not value.strip():
        return []

    v = value.strip()
    v_lower = v.lower()
    v_words = [w for w in v_lower.split() if len(w) >= 3]

    suggestions = []
    seen: set = set()

    def _add(name: str, conf: int, source: str = "synonym"):
        key = name.strip().lower()
        if key and key not in seen:
            seen.add(key)
            suggestions.append({"name": name, "confidence": conf, "source": source})

    # 1. Direct synonym match (highest confidence)
    std_val, conf = standardize_field_value(v, field_type)
    if std_val:
        _add(std_val, conf)

    # 2. Canonical set — find canonicals that share words with the input
    scored = []
    for canon in cfg["canonical"]:
        c_lower = canon.lower()
        overlap = sum(1 for w in v_words if w in c_lower)
        if overlap > 0:
            scored.append((canon, overlap))
    scored.sort(key=lambda x: -x[1])
    for canon, _ in scored[:5]:
        _add(canon, 70)

    # 3. Reverse map — aliases that are substrings of or equal to the input
    for alias, canon in cfg["rev_map"].items():
        if alias in v_lower or v_lower in alias:
            _add(canon, 75)

    return suggestions[:6]


def override_standardized_names_batch(ids: list, new_name: str) -> int:
    """
    Update standardized_name for ALL given product IDs to new_name.
    Used when a group of original_names share the same standardized_name
    and the user edits the canonical form.
    """
    conn = _get_db()
    try:
        conn.executemany(
            "UPDATE standardized_products "
            "SET standardized_name=?, status='overridden', confidence=100 "
            "WHERE id=?",
            [(new_name, id_) for id_ in ids],
        )
        conn.commit()
        return len(ids)
    finally:
        conn.close()


def override_standardized_fields_batch(ids: list, new_value: str) -> int:
    """
    Update standardized_value for ALL given field IDs to new_value.
    Used when a group of original_values share the same standardized_value.
    """
    conn = _get_db()
    try:
        conn.executemany(
            "UPDATE standardized_fields "
            "SET standardized_value=?, status='overridden', confidence=100 "
            "WHERE id=?",
            [(new_value, id_) for id_ in ids],
        )
        conn.commit()
        return len(ids)
    finally:
        conn.close()


def get_standardization_stats() -> dict:
    conn = _get_db()
    try:
        total = conn.execute("SELECT COUNT(*) FROM standardized_products").fetchone()[0]
        high  = conn.execute("SELECT COUNT(*) FROM standardized_products WHERE confidence >= 90").fetchone()[0]
        med   = conn.execute("SELECT COUNT(*) FROM standardized_products WHERE confidence >= 70 AND confidence < 90").fetchone()[0]
        low   = conn.execute("SELECT COUNT(*) FROM standardized_products WHERE confidence < 70").fetchone()[0]
        return {"total": total, "high_confidence": high, "medium_confidence": med, "low_confidence": low}
    finally:
        conn.close()


def purge_stale_standardized_products() -> int:
    """
    Re-scan all remaining uploaded files and delete any standardized_products
    rows whose original_name no longer appears in ANY file.
    Also updates occurrence_count for surviving rows.
    Called after a file is deleted from the ingestion list.
    Returns the number of rows purged.
    """
    conn_meta = _get_db()
    uploads = conn_meta.execute(
        "SELECT id, filename, file_path, file_type FROM uploads WHERE status = 'uploaded'"
    ).fetchall()
    conn_meta.close()

    # Collect all product names still present across remaining files
    surviving_names: dict[str, dict] = {}  # {name: {platform, count}}

    for upload in uploads:
        filename  = upload["filename"]
        file_path = upload["file_path"]
        file_type = upload["file_type"]
        platform  = detect_platform(filename)

        if not os.path.exists(file_path):
            continue

        try:
            with open(file_path, "rb") as fh:
                contents = fh.read()

            if file_type in ("xlsx", "xls"):
                df = pd.read_excel(io.BytesIO(contents), sheet_name=0)
            elif file_type == "csv":
                try:
                    df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(contents), encoding="latin-1")
            else:
                continue

            df.columns = [str(c).strip() for c in df.columns]
            name_col = _pick_name_column(list(df.columns))
            if name_col is None:
                continue

            for raw_name in df[name_col].dropna().astype(str).tolist():
                raw_name = raw_name.strip()
                if not raw_name:
                    continue
                if raw_name in surviving_names:
                    surviving_names[raw_name]["count"] += 1
                else:
                    surviving_names[raw_name] = {"platform": platform, "count": 1}

        except Exception as e:
            logger.error(f"Error reading {filename} during purge: {e}")
            continue

    # Delete rows not in surviving_names; update counts for survivors
    conn = _get_db()
    purged = 0
    try:
        all_products = conn.execute(
            "SELECT id, original_name FROM standardized_products"
        ).fetchall()

        for prod in all_products:
            if prod["original_name"] not in surviving_names:
                conn.execute(
                    "DELETE FROM standardized_products WHERE id = ?", (prod["id"],)
                )
                purged += 1
            else:
                info = surviving_names[prod["original_name"]]
                conn.execute(
                    "UPDATE standardized_products SET occurrence_count = ?, platform = ? WHERE id = ?",
                    (info["count"], info["platform"], prod["id"])
                )

        conn.commit()
        logger.info(f"Purge complete — removed {purged} stale standardized_products rows.")
    finally:
        conn.close()

    return purged


# ─────────────────────────────────────────────────────────────────────────────
# Generic field standardization (brand, category, sub_category)
# ─────────────────────────────────────────────────────────────────────────────

FIELD_CONFIG = {
    "brand": {
        "rev_map":      _BRAND_MAP,
        "canonical":    _BRAND_CANONICAL,
        "col_keywords": [
            "brand", "brand_name", "brand name", "designer name",
            "designer_name", "manufacturer", "manufacturer_name",
        ],
        "label": "Brand",
    },
    "category": {
        "rev_map":      _CATEGORY_MAP,
        "canonical":    _CATEGORY_CANONICAL,
        "col_keywords": [
            "sku_category", "category", "main_category", "product_category",
            "cat", "article type", "article_type", "l1_category", "top_slug",
            "analytic_vertical", "category_name",
        ],
        "label": "Category",
    },
    "sub_category": {
        "rev_map":      _SUBTYPE_MAP,
        "canonical":    _SUBTYPE_CANONICAL,
        "col_keywords": [
            "sub_category", "subcategory", "sub_cat", "sub_type", "subtype",
            "l3", "product_type", "sub category",
        ],
        "label": "Sub Category",
    },
}


def init_standardize_fields_table():
    """Create standardized_fields table for brand / category / sub_category."""
    conn = _get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS standardized_fields (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                field_type         TEXT    NOT NULL,
                original_value     TEXT    NOT NULL,
                standardized_value TEXT    NOT NULL,
                confidence         INTEGER NOT NULL DEFAULT 0,
                platform           TEXT    NOT NULL DEFAULT 'Unknown',
                status             TEXT    NOT NULL DEFAULT 'auto',
                occurrence_count   INTEGER NOT NULL DEFAULT 1,
                UNIQUE(field_type, original_value)
            )
        """)
        conn.commit()
    finally:
        conn.close()


def standardize_field_value(value: str, field_type: str) -> tuple[str, int]:
    """
    Standardize a single brand/category/sub_category value using synonym maps.
    Returns (standardized_value, confidence 0–100).
    """
    cfg = FIELD_CONFIG.get(field_type)
    if not cfg or not value or not value.strip():
        return value, 0

    v = value.strip()
    v_lower = v.lower()

    # 1. Already a canonical form
    if v in cfg["canonical"]:
        return v, 100

    # 2. Case-insensitive canonical match
    for canon in cfg["canonical"]:
        if canon.lower() == v_lower:
            return canon, 100

    # 3. Direct single-value synonym match
    if v_lower in cfg["rev_map"]:
        return cfg["rev_map"][v_lower], 85

    # 4. Multi-word sliding window synonym match
    words = v.split()
    for window in [3, 2, 1]:
        for i in range(len(words) - window + 1):
            phrase = " ".join(words[i:i + window]).lower()
            if phrase in cfg["rev_map"]:
                return cfg["rev_map"][phrase], 75

    # 5. Title-case fallback (no synonym found)
    return v.title(), 50


def _pick_field_column(columns: list, field_type: str) -> Optional[str]:
    """Return the best-matching column name for the given field_type."""
    cfg = FIELD_CONFIG.get(field_type, {})
    keywords = [k.lower() for k in cfg.get("col_keywords", [])]
    lc = {c.lower().strip(): c for c in columns}
    for kw in keywords:
        if kw in lc:
            return lc[kw]
    return None


def run_standardization_fields(field_type: str) -> int:
    """
    Read all uploaded files, extract values for the given field_type
    (brand/category/sub_category), standardize each unique value,
    and upsert into standardized_fields.
    Already-overridden rows are never touched.
    """
    init_standardize_fields_table()
    if field_type not in FIELD_CONFIG:
        return 0

    conn_meta = _get_db()
    uploads = conn_meta.execute(
        "SELECT id, filename, file_path, file_type FROM uploads WHERE status = 'uploaded'"
    ).fetchall()
    conn_meta.close()

    value_info: dict = {}  # {original_value: {platform, count}}

    for upload in uploads:
        filename  = upload["filename"]
        file_path = upload["file_path"]
        file_type = upload["file_type"]
        platform  = detect_platform(filename)

        file_path = _resolve_file_path(file_path, filename)
        if not file_path:
            logger.warning(f"File not found for upload: {filename}")
            continue

        try:
            with open(file_path, "rb") as fh:
                contents = fh.read()

            if file_type in ("xlsx", "xls"):
                df = pd.read_excel(io.BytesIO(contents), sheet_name=0)
            elif file_type == "csv":
                try:
                    df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(contents), encoding="latin-1")
            else:
                continue

            df.columns = [str(c).strip() for c in df.columns]
            col = _pick_field_column(list(df.columns), field_type)
            if col is None:
                logger.info(f"No '{field_type}' column found in {filename}")
                continue

            for raw_val in df[col].dropna().astype(str).tolist():
                raw_val = raw_val.strip()
                if not raw_val or raw_val.lower() in ("nan", "none", "unknown", "n/a", ""):
                    continue
                if raw_val in value_info:
                    value_info[raw_val]["count"] += 1
                else:
                    value_info[raw_val] = {"platform": platform, "count": 1}

        except Exception as e:
            logger.error(f"Error reading {filename} for field '{field_type}': {e}")
            continue

    conn = _get_db()
    total = 0
    try:
        for raw_val, info in value_info.items():
            existing = conn.execute(
                "SELECT status FROM standardized_fields WHERE field_type = ? AND original_value = ?",
                (field_type, raw_val)
            ).fetchone()

            if existing and existing["status"] == "overridden":
                conn.execute(
                    "UPDATE standardized_fields SET occurrence_count = ? "
                    "WHERE field_type = ? AND original_value = ?",
                    (info["count"], field_type, raw_val)
                )
                total += 1
                continue

            std_val, confidence = standardize_field_value(raw_val, field_type)
            conn.execute(
                """
                INSERT INTO standardized_fields
                    (field_type, original_value, standardized_value, confidence, platform, status, occurrence_count)
                VALUES (?, ?, ?, ?, ?, 'auto', ?)
                ON CONFLICT(field_type, original_value)
                DO UPDATE SET
                    standardized_value = excluded.standardized_value,
                    confidence         = excluded.confidence,
                    platform           = excluded.platform,
                    occurrence_count   = excluded.occurrence_count,
                    status             = 'auto'
                """,
                (field_type, raw_val, std_val, confidence, info["platform"], info["count"])
            )
            total += 1

        conn.commit()
    finally:
        conn.close()

    logger.info(f"Field standardization complete — {total} unique '{field_type}' values processed.")
    return total


def get_all_standardized_fields(field_type: str) -> list:
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM standardized_fields WHERE field_type = ? "
            "ORDER BY confidence ASC, original_value",
            (field_type,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def override_standardized_field(field_id: int, new_value: str) -> Optional[dict]:
    conn = _get_db()
    try:
        conn.execute(
            """
            UPDATE standardized_fields
               SET standardized_value = ?,
                   status             = 'overridden',
                   confidence         = 100
             WHERE id = ?
            """,
            (new_value, field_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM standardized_fields WHERE id = ?", (field_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_standardization_stats_fields(field_type: str) -> dict:
    conn = _get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM standardized_fields WHERE field_type = ?", (field_type,)
        ).fetchone()[0]
        high = conn.execute(
            "SELECT COUNT(*) FROM standardized_fields WHERE field_type = ? AND confidence >= 90",
            (field_type,)
        ).fetchone()[0]
        med = conn.execute(
            "SELECT COUNT(*) FROM standardized_fields "
            "WHERE field_type = ? AND confidence >= 70 AND confidence < 90",
            (field_type,)
        ).fetchone()[0]
        low = conn.execute(
            "SELECT COUNT(*) FROM standardized_fields WHERE field_type = ? AND confidence < 70",
            (field_type,)
        ).fetchone()[0]
        return {"total": total, "high_confidence": high, "medium_confidence": med, "low_confidence": low}
    finally:
        conn.close()


def get_llm_suggestion(product_name: str, api_key: str, provider: str = "groq", platform: str = None) -> dict:
    """
    Call OpenAI to parse a single product name into structured taxonomy.
    The LLM prompt is seeded with the synonym_config vocabulary so it prefers
    canonical forms.  After parsing, the response is post-validated by snapping
    each field to the nearest synonym match, and container defaults are applied
    based on sub_type and platform.
    Also generates a pure-synonym suggestion (no LLM) and returns it alongside.
    Returns {standardized_name, confidence, taxonomy, synonym_suggestion}.
    Does NOT write to DB — caller decides what to do with the result.
    """
    import json as _json
    import re as _re
    from groq import Groq

    # ── 1. Always generate the synonym-grounded suggestion (no API needed) ───
    synonym_result = generate_synonym_suggestion(product_name, platform=platform)

    # ── 2. Build controlled vocabulary strings for prompt injection ───────────
    vocab_brands     = ", ".join(sorted(_BRAND_CANONICAL))
    vocab_categories = ", ".join(sorted(_CATEGORY_CANONICAL))
    vocab_subtypes   = ", ".join(sorted(_SUBTYPE_CANONICAL))
    vocab_containers = ", ".join(sorted(_CONTAINER_CANONICAL))
    vocab_units      = ", ".join(sorted(_UNIT_CANONICAL))

    # Build platform-specific prompt section
    platform_rules = ""
    if platform and platform.lower() in ("amazon", "flipkart"):
        platform_rules = f"""
Platform-specific rules (source platform: {platform}):
- If no container is explicitly mentioned in the product name, default container to "Bottle" for liquid products (oils, washes, shampoos, juices, beverages, lotions).
- For sub_type, use the MOST SPECIFIC match from the vocabulary: e.g. "Mustard Oil" not "Cooking Oil", "Sesame Oil" not just "Oil".
- For long product titles with '|' separators, focus on the first segment for brand/product/size info.
"""

    # ── 3. Call LLM with vocabulary-constrained prompt ───────────────────────
    client = Groq(api_key=api_key)

    prompt = f"""You are a product taxonomy expert for Indian e-commerce.

Parse this product name and return a JSON object ONLY (no markdown, no explanation):
"{product_name}"

JSON keys required:
- main_category : broad category e.g. Skincare, Haircare, Personal Care, Food, Electronics
- sub_type      : specific product type e.g. Face Wash, Shampoo, Body Lotion, Chips, Mustard Oil, Sesame Oil
- brand         : brand name, Title Case
- size          : numeric value only (e.g. 50, 250, 3.6) or null
- unit          : ml / g / kg / l / oz or null
- container     : Bottle / Tube / Jar / Pump / Pouch / Can or null
- confidence    : 0.0 to 1.0

Rules:
- Normalise units: ML→ml, gm→g, Gm→g, GMS→g, LTR→l, Ltr→l
- Use null for any field you cannot determine
- Title Case for brand, sub_type, main_category
- For sub_type, always prefer the MOST SPECIFIC product type (e.g. "Mustard Oil" over "Cooking Oil", "Coconut Oil" over "Oil")

IMPORTANT — You MUST prefer values from this controlled vocabulary when they match the product:
Allowed brands: {vocab_brands}
Allowed categories: {vocab_categories}
Allowed sub_types: {vocab_subtypes}
Allowed containers: {vocab_containers}
Allowed units: {vocab_units}
If the product clearly matches one of these values, you MUST use the exact canonical form listed above.
{platform_rules}
Examples:
Input: "Nivea Men Oil Ctrl 50ml glass btl"
Output: {{"main_category":"Skincare","sub_type":"Face Wash","brand":"Nivea","size":50,"unit":"ml","container":"Bottle","confidence":0.90}}

Input: "Dove Body Wash 250ML Pump"
Output: {{"main_category":"Personal Care","sub_type":"Body Wash","brand":"Dove","size":250,"unit":"ml","container":"Pump","confidence":0.95}}

Input: "Tez Mustard Oil for Cooking 1L | PT3 Kachchi Ghani Sarson Ka Tel | 100% Pure"
Output: {{"main_category":"Food","sub_type":"Mustard Oil","brand":"Tez","size":1,"unit":"l","container":"Bottle","confidence":0.90}}

Input: "Parachute Coconut Oil 500ml bottle"
Output: {{"main_category":"Food","sub_type":"Coconut Oil","brand":"Parachute","size":500,"unit":"ml","container":"Bottle","confidence":0.95}}

Now parse: "{product_name}"
JSON only:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a product taxonomy expert. Respond with valid JSON only. No markdown, no code fences, no explanation."},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.1,
        max_tokens=300,
    )

    raw_text = response.choices[0].message.content.strip()
    # Strip any accidental markdown fences
    raw_text = _re.sub(r"^```(?:json)?\s*", "", raw_text, flags=_re.MULTILINE)
    raw_text = _re.sub(r"\s*```$",          "", raw_text, flags=_re.MULTILINE)
    raw_text = raw_text.strip()

    taxonomy = _json.loads(raw_text)

    # Ensure all expected keys exist
    for key in ("main_category", "sub_type", "brand", "size", "unit", "container"):
        taxonomy.setdefault(key, None)

    # Clean size to float
    if taxonomy["size"] is not None:
        try:
            taxonomy["size"] = float(taxonomy["size"])
        except (ValueError, TypeError):
            taxonomy["size"] = None

    # Clean confidence to 0.0–1.0 float
    try:
        taxonomy["confidence"] = max(0.0, min(1.0, float(taxonomy.get("confidence", 0.5))))
    except (ValueError, TypeError):
        taxonomy["confidence"] = 0.5

    # ── 4. Post-validate: snap LLM output to synonym canonical forms ─────────
    taxonomy = snap_taxonomy_to_synonyms(taxonomy)

    # ── 5. Apply container defaults if LLM returned null ─────────────────────
    if not taxonomy.get("container"):
        sub_type_defaults = _SYNONYM_CFG.get("sub_type_container_defaults", {})
        if taxonomy.get("sub_type") and taxonomy["sub_type"] in sub_type_defaults:
            taxonomy["container"] = sub_type_defaults[taxonomy["sub_type"]]
        elif platform:
            platform_defaults = _SYNONYM_CFG.get("platform_container_defaults", {})
            taxonomy["container"] = platform_defaults.get(
                platform.lower(), platform_defaults.get("_default")
            )

    # Build a clean human-readable standardized name
    parts = []
    if taxonomy.get("brand"):
        parts.append(taxonomy["brand"])
    if taxonomy.get("sub_type"):
        parts.append(taxonomy["sub_type"])
    if taxonomy.get("size") is not None and taxonomy.get("unit"):
        size_val = taxonomy["size"]
        size_str = str(int(size_val)) if size_val == int(size_val) else str(size_val)
        parts.append(f"{size_str}{taxonomy['unit']}")
    if taxonomy.get("container"):
        parts.append(f"— {taxonomy['container']}")

    standardized = " ".join(parts) if parts else product_name
    confidence_int = int(taxonomy["confidence"] * 100)

    logger.info(f"LLM suggestion for '{product_name[:60]}...' → '{standardized}' ({confidence_int}%)")

    return {
        "standardized_name":  standardized,
        "confidence":         confidence_int,
        "taxonomy":           taxonomy,
        "synonym_suggestion": synonym_result,
    }