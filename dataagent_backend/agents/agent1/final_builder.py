"""
agents/agent1/final_builder.py
================================
Builds the `final_dataset` table from all uploaded files by applying:
  1. Column mappings (Screen 2)          — renames source columns to standard names
  2. Product name standardization        — from standardized_products table
  3. Brand / category overrides          — from standardized_fields table
  4. Sub-category derivation             — from product name taxonomy when no direct column

Called after any standardization change so that analytics always reflects the
latest human-reviewed data.
"""

import io
import os
import logging
import sqlite3
from pathlib import Path
from typing import Optional

import pandas as pd

from agents.agent1.mapping import detect_platform
from agents.agent1.standardizer import generate_synonym_suggestion, _resolve_file_path

logger = logging.getLogger(__name__)

DB_PATH     = str(Path(__file__).resolve().parent.parent.parent / "dataagent.db")
UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_final_dataset_table():
    """Create final_dataset table. Safe to call repeatedly."""
    conn = _get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS final_dataset (
                id                     INTEGER PRIMARY KEY AUTOINCREMENT,
                source_upload_id       INTEGER,
                platform               TEXT,
                transaction_id         TEXT,
                transaction_date       TEXT,
                sku_id                 TEXT,
                original_product_name  TEXT,
                product_name           TEXT,
                original_brand         TEXT,
                brand                  TEXT,
                original_category      TEXT,
                category               TEXT,
                sub_category           TEXT,
                manufacturer_name      TEXT,
                region                 TEXT,
                channel_type           TEXT,
                units_sold             REAL,
                mrp                    REAL,
                invoice_value_incl_gst REAL,
                built_at               TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Lookup loaders
# ─────────────────────────────────────────────────────────────────────────────

def _load_std_products(conn) -> dict:
    """Returns {original_name: standardized_name}."""
    rows = conn.execute(
        "SELECT original_name, standardized_name FROM standardized_products"
    ).fetchall()
    return {r["original_name"]: r["standardized_name"] for r in rows}


def _load_std_fields(conn, field_type: str) -> dict:
    """Returns {original_value: standardized_value} for the given field_type."""
    rows = conn.execute(
        "SELECT original_value, standardized_value FROM standardized_fields "
        "WHERE field_type = ?",
        (field_type,),
    ).fetchall()
    return {r["original_value"]: r["standardized_value"] for r in rows}


def _get_column_mappings(conn, platform: str) -> dict:
    rows = conn.execute(
        "SELECT source_column, target_field FROM column_mappings "
        "WHERE LOWER(platform) = LOWER(?) "
        "AND target_field IS NOT NULL AND target_field != ''",
        (platform,),
    ).fetchall()
    return {r["source_column"]: r["target_field"] for r in rows}


# ─────────────────────────────────────────────────────────────────────────────
# File loader
# ─────────────────────────────────────────────────────────────────────────────

def _load_file(file_path: str, file_type: str) -> Optional[pd.DataFrame]:
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
            return None
        df.columns = [str(c).strip() for c in df.columns]
        df = df.dropna(how="all")
        return df if len(df) > 0 else None
    except Exception as e:
        logger.error(f"Error loading file {file_path}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Value helpers
# ─────────────────────────────────────────────────────────────────────────────

_EMPTY_STRINGS = {"nan", "none", "n/a", "na", "null", ""}


def _clean_str(v) -> str:
    """Return a clean string, or '' for null/NaN/empty values."""
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in _EMPTY_STRINGS else s


def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(str(v).replace(",", "").strip())
        import math
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Core builder
# ─────────────────────────────────────────────────────────────────────────────

def build_final_dataset() -> int:
    """
    Rebuild the final_dataset table from scratch.

    For each uploaded file:
      1. Load raw data
      2. Rename columns via column_mappings
      3. Substitute product names from standardized_products
      4. Derive taxonomy (brand/category/sub_category) from product name via
         synonym config — cached per unique product name to avoid redundant calls
      5. Override brand/category with values from standardized_fields if present
         (these capture human edits from Screen 3)
      6. Batch-insert all rows into final_dataset

    Returns total row count written.
    """
    conn = _get_db()
    try:
        # ── Load all lookup tables once ──────────────────────────────────────
        std_products = _load_std_products(conn)
        brand_map    = _load_std_fields(conn, "brand")
        cat_map      = _load_std_fields(conn, "category")
        sub_cat_map  = _load_std_fields(conn, "sub_category")

        uploads = conn.execute(
            "SELECT id, filename, file_path, file_type "
            "FROM uploads WHERE status = 'uploaded'"
        ).fetchall()

        # Full rebuild — clear existing data
        conn.execute("DELETE FROM final_dataset")
        conn.commit()

        taxonomy_cache: dict = {}   # {original_product_name: {brand, category, sub_category}}
        total_rows = 0

        for upload in uploads:
            upload_id = upload["id"]
            filename  = upload["filename"]
            file_path = _resolve_file_path(upload["file_path"], filename)
            file_type = upload["file_type"]
            platform  = detect_platform(filename)

            if not file_path:
                logger.warning(f"File not found for upload: {filename}")
                continue

            df = _load_file(file_path, file_type)
            if df is None:
                continue

            # ── Apply column mappings ──────────────────────────────────────
            col_map = _get_column_mappings(conn, platform)
            if col_map:
                rename = {src: tgt for src, tgt in col_map.items() if src in df.columns}
                if rename:
                    df = df.rename(columns=rename)

            cols = set(df.columns)

            # ── Pre-compute taxonomy for all unique product names ──────────
            if "product_name" in cols:
                unique_names = [
                    n for n in df["product_name"].fillna("").astype(str).str.strip().unique()
                    if n and n.lower() not in _EMPTY_STRINGS
                ]
                for name in unique_names:
                    if name not in taxonomy_cache:
                        result = generate_synonym_suggestion(name, platform=platform)
                        tax = result.get("taxonomy", {})
                        taxonomy_cache[name] = {
                            "brand":        tax.get("brand") or "",
                            "category":     tax.get("main_category") or "",
                            "sub_category": tax.get("sub_type") or "",
                        }

            # ── Build vectorised computed columns ──────────────────────────

            # Product name
            if "product_name" in cols:
                df["_pname"] = df["product_name"].fillna("").astype(str).str.strip()
                df["_pname"] = df["_pname"].apply(
                    lambda x: "" if x.lower() in _EMPTY_STRINGS else x
                )
            else:
                df["_pname"] = ""

            df["_std_pname"] = df["_pname"].map(
                lambda x: std_products.get(x, x) if x else ""
            )

            # Taxonomy from product name
            df["_tax_brand"] = df["_pname"].map(
                lambda x: taxonomy_cache.get(x, {}).get("brand", "")
            )
            df["_tax_cat"] = df["_pname"].map(
                lambda x: taxonomy_cache.get(x, {}).get("category", "")
            )
            df["_tax_sub"] = df["_pname"].map(
                lambda x: taxonomy_cache.get(x, {}).get("sub_category", "")
            )

            # Brand: file column → taxonomy fallback → standardized_fields lookup
            if "brand" in cols:
                df["_orig_brand"] = df["brand"].fillna("").astype(str).str.strip().apply(
                    lambda x: "" if x.lower() in _EMPTY_STRINGS else x
                )
            else:
                df["_orig_brand"] = ""
            df["_orig_brand"] = df.apply(
                lambda r: r["_orig_brand"] if r["_orig_brand"] else r["_tax_brand"],
                axis=1,
            )
            df["_std_brand"] = df["_orig_brand"].map(
                lambda x: brand_map.get(x, x) if x else ""
            )

            # Category: file column → taxonomy fallback → standardized_fields lookup
            cat_col_used = next(
                (c for c in ("sku_category", "category") if c in cols), None
            )
            if cat_col_used:
                df["_orig_cat"] = df[cat_col_used].fillna("").astype(str).str.strip().apply(
                    lambda x: "" if x.lower() in _EMPTY_STRINGS else x
                )
            else:
                df["_orig_cat"] = ""
            df["_orig_cat"] = df.apply(
                lambda r: r["_orig_cat"] if r["_orig_cat"] else r["_tax_cat"],
                axis=1,
            )
            df["_std_cat"] = df["_orig_cat"].map(
                lambda x: cat_map.get(x, x) if x else ""
            )

            # Sub-category: file column → taxonomy fallback → standardized_fields lookup
            if "sub_category" in cols:
                df["_orig_sub"] = df["sub_category"].fillna("").astype(str).str.strip().apply(
                    lambda x: "" if x.lower() in _EMPTY_STRINGS else x
                )
            else:
                df["_orig_sub"] = ""
            df["_orig_sub"] = df.apply(
                lambda r: r["_orig_sub"] if r["_orig_sub"] else r["_tax_sub"],
                axis=1,
            )
            df["_std_sub"] = df["_orig_sub"].map(
                lambda x: sub_cat_map.get(x, x) if x else ""
            )

            # ── Build insert rows ──────────────────────────────────────────

            def _col(col_name):
                return df[col_name].tolist() if col_name in cols else [None] * len(df)

            rows_to_insert = list(zip(
                [upload_id] * len(df),                          # source_upload_id
                [platform]  * len(df),                          # platform
                [_clean_str(v) or None for v in _col("transaction_id")],
                [_clean_str(v) or None for v in _col("transaction_date")],
                [_clean_str(v) or None for v in _col("sku_id")],
                [v or None for v in df["_pname"].tolist()],     # original_product_name
                [v or None for v in df["_std_pname"].tolist()], # product_name
                [v or None for v in df["_orig_brand"].tolist()],# original_brand
                [v or None for v in df["_std_brand"].tolist()], # brand
                [v or None for v in df["_orig_cat"].tolist()],  # original_category
                [v or None for v in df["_std_cat"].tolist()],   # category
                [v or None for v in df["_std_sub"].tolist()],   # sub_category
                [_clean_str(v) or None for v in _col("manufacturer_name")],
                [_clean_str(v) or None for v in _col("region")],
                [_clean_str(v) or None for v in _col("channel_type")],
                [_safe_float(v) for v in _col("units_sold")],
                [_safe_float(v) for v in _col("mrp")],
                [_safe_float(v) for v in _col("invoice_value_incl_gst")],
            ))

            conn.executemany("""
                INSERT INTO final_dataset (
                    source_upload_id, platform,
                    transaction_id, transaction_date,
                    sku_id, original_product_name, product_name,
                    original_brand, brand,
                    original_category, category, sub_category,
                    manufacturer_name, region, channel_type,
                    units_sold, mrp, invoice_value_incl_gst,
                    built_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    datetime('now')
                )
            """, rows_to_insert)
            conn.commit()

            total_rows += len(rows_to_insert)
            logger.info(f"final_dataset: wrote {len(rows_to_insert)} rows from {filename}")

        logger.info(f"Final dataset rebuild complete — {total_rows} total rows.")
        return total_rows

    finally:
        conn.close()