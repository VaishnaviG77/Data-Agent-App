"""
agents/agent1/mapping.py  –  FastAPI router for Screen 2 (Column Mapping & Cleaning)

Endpoints
---------
GET  /api/mapping/rows     → all mapping rows from column_mappings table
GET  /api/mapping/targets  → available standard target field names
POST /api/mapping/apply    → save user's manual mappings

Tables created via init_mapping_tables() called from main.py lifespan
---------------------------------------------------------------------
column_mappings   – one row per (source_column, platform)
mapping_targets   – configurable list of standard field names
"""

import os
import re
import sqlite3
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
import yaml

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mapping", tags=["mapping"])

# ─────────────────────────────────────────────────────────────────────────────
# Platform detection
# ─────────────────────────────────────────────────────────────────────────────
KNOWN_PLATFORMS = [
    "shopify", "myntra", "ajio", "tatacliq", "nykaa", "pernia",
    "amazon", "blinkit", "bigbasket", "zepto", "flipkart", "instamart",
]

PLATFORM_ALIASES: dict[str, str] = {
    "tata cliq": "tatacliq",
    "tata_cliq": "tatacliq",
    "big basket": "bigbasket",
    "big_basket": "bigbasket",
    "swiggy instamart": "instamart",
    "swiggy_instamart": "instamart",
    "nykaa fashion": "nykaa",
    "nykaa_fashion": "nykaa",
    "pernias": "pernia",
    "pernia's": "pernia",
    "pernias pop up": "pernia",
}


def detect_platform(filename: str) -> str:
    """
    Derive the platform/channel name from the filename.

    Strategy (in order):
      1. Check exact alias matches in the lowered filename.
      2. Check if any known platform keyword appears as a substring.
      3. Fall back to the first meaningful word of the filename.
    """
    name = os.path.splitext(filename)[0].lower().replace("-", " ").replace("_", " ")

    # 1 — alias table (longest match first to avoid partial collisions)
    for alias in sorted(PLATFORM_ALIASES, key=len, reverse=True):
        if alias in name:
            return PLATFORM_ALIASES[alias].title()

    # 2 — known platform list
    for platform in KNOWN_PLATFORMS:
        if platform in name.replace(" ", ""):
            return platform.title()

    # 3 — fallback: first word that isn't a generic term
    generic = {"export", "feed", "catalog", "data", "report", "file", "upload",
               "sales", "orders", "products", "inventory", "raw", "final", "copy"}
    for word in name.split():
        if word not in generic and len(word) > 1:
            return word.title()

    return "Unknown"


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers  —  path matches database/db.py (relative to THIS file)
# ─────────────────────────────────────────────────────────────────────────────
# This file lives at agents/agent1/mapping.py
# database/db.py uses: os.path.join(os.path.dirname(__file__), "..", "dataagent.db")
#   → resolves to dataagent_backend/dataagent.db
# We do the same:  go up two levels from agents/agent1/ → dataagent_backend/
DB_PATH = str(Path(__file__).resolve().parent.parent.parent / "dataagent.db")

# Default seed targets — the "Available Targets" list in the sidebar
DEFAULT_TARGETS = [
    # Core commerce / universal schema fields
    "transaction_id", "transaction_date", "sku_id", "product_name",
    "brand", "sku_category", "manufacturer_name", "region",
    "channel_type", "units_sold", "mrp", "invoice_value_incl_gst",
    # Extended fields users commonly need
    "fulfillment_method", "color", "product_variant", "custom_field_1",
    "weight_kg", "tax_category", "stock_quantity", "discount_percent",
    "return_reason", "courier_partner", "warehouse_location",
    "hsn_code", "size", "gender", "season",
]

# ─────────────────────────────────────────────────────────────────────────────
# Schema registry  —  loads schema_registry.yaml sitting next to this package
# ─────────────────────────────────────────────────────────────────────────────
_SCHEMA_REGISTRY_PATH = Path(__file__).resolve().parent.parent.parent / "schema_registry.yaml"

def _load_schema_registry() -> dict:
    """
    Returns { "tatacliq": {"Sub Order ID": "transaction_id", ...}, ... }
    Keys are platform names lowercased with spaces/underscores stripped,
    so they match what detect_platform() returns after .lower().replace(" ","").
    Values are {source_column: target_field} — nulls and _defaults are skipped.
    """
    if not _SCHEMA_REGISTRY_PATH.exists():
        logger.warning(f"schema_registry.yaml not found at {_SCHEMA_REGISTRY_PATH}")
        return {}
    try:
        with open(_SCHEMA_REGISTRY_PATH, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        overrides = raw.get("manual_overrides", {}) or {}
        registry: dict[str, dict[str, str]] = {}
        for platform, mapping in overrides.items():
            # normalise key: "TataCliq" → "tatacliq", "FlipkartMinutes" → "flipkartminutes"
            key = platform.lower().replace(" ", "").replace("_", "")
            source_to_target: dict[str, str] = {}
            for target_field, source_col in mapping.items():
                if target_field == "_defaults" or source_col is None:
                    continue
                source_to_target[str(source_col)] = target_field
            if source_to_target:
                registry[key] = source_to_target
        logger.info(f"Schema registry loaded for: {list(registry.keys())}")
        return registry
    except Exception as e:
        logger.error(f"Failed to load schema_registry.yaml: {e}")
        return {}

# Loaded once at startup — no file I/O per request
SCHEMA_REGISTRY: dict[str, dict[str, str]] = _load_schema_registry()

def _get_registry_mappings(platform: str) -> dict[str, str]:
    """
    Given a platform name as returned by detect_platform() e.g. 'TataCliq',
    return its {source_col: target_field} dict from the registry, or {} if unknown.
    """
    key = platform.lower().replace(" ", "").replace("_", "")
    return SCHEMA_REGISTRY.get(key, {})

VALID_STATUSES = {"ok", "warning", "missing"}


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_mapping_tables():
    """Create tables + seed defaults.  Safe to call repeatedly."""
    conn = _get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS column_mappings (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                source_column TEXT    NOT NULL,
                target_field  TEXT,
                platform      TEXT    NOT NULL,
                status        TEXT    NOT NULL DEFAULT 'missing',
                created_at    TEXT    DEFAULT (datetime('now')),
                updated_at    TEXT    DEFAULT (datetime('now')),
                UNIQUE(source_column, platform)
            );

            CREATE TABLE IF NOT EXISTS mapping_targets (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT    NOT NULL UNIQUE
            );
        """)

        count = conn.execute("SELECT COUNT(*) FROM mapping_targets").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT OR IGNORE INTO mapping_targets (name) VALUES (?)",
                [(t,) for t in DEFAULT_TARGETS],
            )
            logger.info(f"Seeded {len(DEFAULT_TARGETS)} default mapping targets.")

        conn.commit()
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Helper: populate column_mappings after ingest
# ─────────────────────────────────────────────────────────────────────────────
_WARNING_HINTS = {
    "weight_gm":   "unit conversion grams → kg",
    "weight_gram":  "unit conversion grams → kg",
    "weight_g":    "unit conversion grams → kg",
    "mrp":         "price field rename / currency context",
    "tax_class":   "taxonomy mismatch",
    "tax_code":    "taxonomy mismatch",
    "tax_rate":    "taxonomy mismatch",
    "price_inr":   "currency context",
    "cost_inr":    "currency context",
}


def _decide_status(source_col: str, target_field: Optional[str], confidence: float) -> str:
    if target_field is None:
        return "missing"
    norm = source_col.lower().replace("-", "_").replace(" ", "_")
    for hint_key in _WARNING_HINTS:
        if hint_key in norm:
            return "warning"
    if confidence < 0.60:
        return "warning"
    return "ok"


def populate_mappings_for_file(
    filename: str,
    column_mapping: dict[str, Optional[str]],
    scores: Optional[dict[str, dict[str, float]]] = None,
):
    """
    Write auto-detected mappings into `column_mappings` table.

    Parameters
    ----------
    filename        : original uploaded filename (used for platform detection)
    column_mapping  : { universal_field: raw_column_or_None } from auto_detect_mapping
    scores          : optional { universal_field: {raw_col: score} } for confidence
    """
    platform = detect_platform(filename)
    conn = _get_db()
    try:
        reverse: dict[str, str] = {}
        for target, source in column_mapping.items():
            if source is not None:
                reverse[source] = target

        rows_to_upsert = []
        for source_col, target_field in reverse.items():
            conf = 1.0
            if scores and target_field in scores and source_col in scores[target_field]:
                conf = scores[target_field][source_col]
            status = _decide_status(source_col, target_field, conf)
            rows_to_upsert.append((source_col, target_field, platform, status))

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        for src, tgt, plat, st in rows_to_upsert:
            conn.execute(
                """
                INSERT INTO column_mappings (source_column, target_field, platform, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_column, platform)
                DO UPDATE SET target_field = excluded.target_field,
                              status       = excluded.status,
                              updated_at   = excluded.updated_at
                """,
                (src, tgt, plat, st, now, now),
            )

        conn.commit()
        logger.info(f"Saved {len(rows_to_upsert)} column mappings for platform={platform}")
    finally:
        conn.close()

def populate_unmapped_columns(filename: str, all_raw_columns: list[str]):
    """
    Two-step mapping on every upload:

    Step 1 — Schema registry:
        For every column that exists in schema_registry.yaml for this platform,
        UPSERT it with the correct target_field and status='ok'.
        This uses ON CONFLICT UPDATE so even old 'missing' rows get corrected.

    Step 2 — HITL fallback:
        Columns NOT in the registry are inserted as status='missing' with no target,
        using INSERT OR IGNORE so manually-saved user mappings are never overwritten.
    """
    platform = detect_platform(filename)
    registry_mappings = _get_registry_mappings(platform)  # {source_col: target_field}

    conn = _get_db()
    try:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        auto_mapped = 0
        needs_hitl  = 0

        for col in all_raw_columns:
            target = registry_mappings.get(col)

            if target:
                # Registry match — always upsert so stale 'missing' rows get fixed
                conn.execute(
                    """
                    INSERT INTO column_mappings
                        (source_column, target_field, platform, status, created_at, updated_at)
                    VALUES (?, ?, ?, 'ok', ?, ?)
                    ON CONFLICT(source_column, platform)
                    DO UPDATE SET target_field = excluded.target_field,
                                  status       = 'ok',
                                  updated_at   = excluded.updated_at
                    """,
                    (col, target, platform, now, now),
                )
                auto_mapped += 1
            else:
                # No registry match — insert as missing only if no row exists yet
                # (preserves any manual mapping the user already saved)
                conn.execute(
                    """
                    INSERT OR IGNORE INTO column_mappings
                        (source_column, target_field, platform, status, created_at, updated_at)
                    VALUES (?, NULL, ?, 'missing', ?, ?)
                    """,
                    (col, platform, now, now),
                )
                needs_hitl += 1

        conn.commit()
        logger.info(
            f"[{platform}] Mapping — "
            f"registry auto-mapped: {auto_mapped}, "
            f"needs HITL: {needs_hitl}, "
            f"total: {len(all_raw_columns)}"
        )
    finally:
        conn.close()

# def populate_unmapped_columns(filename: str, all_raw_columns: list[str]):
#     """
#     Ensure every raw column appears in column_mappings.
#     Columns not yet present get status='missing'.
#     """
#     platform = detect_platform(filename)
#     conn = _get_db()
#     try:
#         now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
#         for col in all_raw_columns:
#             conn.execute(
#                 """
#                 INSERT OR IGNORE INTO column_mappings
#                     (source_column, target_field, platform, status, created_at, updated_at)
#                 VALUES (?, NULL, ?, 'missing', ?, ?)
#                 """,
#                 (col, platform, now, now),
#             )
#         conn.commit()
#     finally:
#         conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Cascading deletion helpers
# ─────────────────────────────────────────────────────────────────────────────

def delete_orphaned_mappings(orphaned_columns: list[dict]):
    """
    Delete column_mappings rows for (source_column, platform) pairs that
    no longer belong to any uploaded file.
    Called after an upload is removed and its link rows are purged.
    """
    if not orphaned_columns:
        return 0
    conn = _get_db()
    deleted = 0
    try:
        for item in orphaned_columns:
            cursor = conn.execute(
                "DELETE FROM column_mappings WHERE source_column = ? AND platform = ?",
                (item["source_column"], item["platform"]),
            )
            deleted += cursor.rowcount
        conn.commit()
        logger.info(f"Cascade-deleted {deleted} orphaned column_mappings rows.")
    finally:
        conn.close()
    return deleted


def delete_all_mappings_for_platform(platform: str) -> int:
    """Delete ALL column_mappings rows for a given platform."""
    conn = _get_db()
    try:
        cursor = conn.execute(
            "DELETE FROM column_mappings WHERE platform = ?", (platform,)
        )
        conn.commit()
        logger.info(f"Deleted all column_mappings for platform={platform}: {cursor.rowcount} rows.")
        return cursor.rowcount
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────
class MappingRow(BaseModel):
    source_column: str
    target_field: Optional[str] = None
    status: str
    platform: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class SingleMapping(BaseModel):
    source_column: str
    target_field: str
    platform: str


class ApplyMappingsRequest(BaseModel):
    mappings: list[SingleMapping]


class ApplyMappingsResponse(BaseModel):
    saved: int


class TargetsResponse(BaseModel):
    targets: list[str]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/rows", response_model=list[MappingRow])
def get_mapping_rows(platform: Optional[str] = None):
    """Return all mapping rows, optionally filtered by platform."""
    conn = _get_db()
    try:
        if platform:
            rows = conn.execute(
                "SELECT source_column, target_field, status, platform "
                "FROM column_mappings WHERE LOWER(platform) = LOWER(?) "
                "ORDER BY status DESC, source_column",
                (platform,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT source_column, target_field, status, platform "
                "FROM column_mappings ORDER BY status DESC, source_column"
            ).fetchall()

        return [
            MappingRow(
                source_column=r["source_column"],
                target_field=r["target_field"] if r["target_field"] else "\u2014",
                status=r["status"] if r["status"] in VALID_STATUSES else "missing",
                platform=r["platform"],
            )
            for r in rows
        ]
    finally:
        conn.close()


@router.get("/targets", response_model=TargetsResponse)
def get_mapping_targets():
    """Return the list of available target field names."""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT name FROM mapping_targets ORDER BY name"
        ).fetchall()
        return TargetsResponse(targets=[r["name"] for r in rows])
    finally:
        conn.close()


@router.post("/apply", response_model=ApplyMappingsResponse)
def apply_mappings(body: ApplyMappingsRequest):
    """Save user's manual column mappings."""
    if not body.mappings:
        raise HTTPException(status_code=400, detail="No mappings provided.")

    conn = _get_db()
    saved = 0
    try:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        for m in body.mappings:
            exists = conn.execute(
                "SELECT 1 FROM mapping_targets WHERE name = ?", (m.target_field,)
            ).fetchone()
            if not exists:
                conn.execute(
                    "INSERT OR IGNORE INTO mapping_targets (name) VALUES (?)",
                    (m.target_field,),
                )

            conn.execute(
                """
                INSERT INTO column_mappings
                    (source_column, target_field, platform, status, created_at, updated_at)
                VALUES (?, ?, ?, 'ok', ?, ?)
                ON CONFLICT(source_column, platform)
                DO UPDATE SET target_field = excluded.target_field,
                              status       = 'ok',
                              updated_at   = excluded.updated_at
                """,
                (m.source_column, m.target_field, m.platform, now, now),
            )
            saved += 1

        conn.commit()
        logger.info(f"Applied {saved} manual mappings.")
        return ApplyMappingsResponse(saved=saved)
    finally:
        conn.close()
