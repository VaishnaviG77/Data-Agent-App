"""
routers/analytics.py
=====================
Screen 4 — Analytics Dashboard

Routes:
  GET /api/analytics/summary   → all KPI cards + chart series + brand/product table
  GET /api/analytics/platforms → list of available platform names

Query params for /summary:
  date_from  (YYYY-MM-DD)  – inclusive start date filter
  date_to    (YYYY-MM-DD)  – inclusive end date filter
  platforms  (comma-sep)   – e.g. "Amazon,Blinkit"  (empty = all)
"""

import io
import os
import json
import math
import logging
from collections import defaultdict
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Query

from database.db import get_all_uploads, get_connection as get_db_conn

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_df(file_path: str, filename: str) -> "pd.DataFrame | None":
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        if ext == "csv":
            try:
                df = pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1")
        elif ext in ("xls", "xlsx"):
            df = pd.read_excel(file_path, sheet_name=0)
        elif ext == "json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list):
                        df = pd.DataFrame(v)
                        break
                else:
                    df = pd.DataFrame([data])
            else:
                return None
        else:
            return None
        df.columns = [str(c).strip() for c in df.columns]
        df = df.dropna(how="all")
        return df if len(df) > 0 else None
    except Exception as e:
        logger.warning(f"Could not load {filename}: {e}")
        return None


def _get_column_mappings(platform: str) -> dict:
    conn = get_db_conn()
    try:
        rows = conn.execute(
            "SELECT source_column, target_field FROM column_mappings "
            "WHERE LOWER(platform) = LOWER(?) AND target_field IS NOT NULL AND target_field != ''",
            (platform,)
        ).fetchall()
        return {r["source_column"]: r["target_field"] for r in rows}
    finally:
        conn.close()


def _get_standardized_names() -> dict:
    conn = get_db_conn()
    try:
        rows = conn.execute(
            "SELECT original_name, standardized_name FROM standardized_products"
        ).fetchall()
        return {r["original_name"]: r["standardized_name"] for r in rows}
    finally:
        conn.close()


def _detect_platform(filename: str) -> str:
    lower = filename.lower()
    if "amazon" in lower:       return "Amazon"
    if "flipkart" in lower:     return "Flipkart"
    if "myntra" in lower:       return "Myntra"
    if "nykaa" in lower:        return "Nykaa"
    if "ajio" in lower:         return "Ajio"
    if "tatacliq" in lower or "tata" in lower: return "TataCliq"
    if "blinkit" in lower:      return "Blinkit"
    if "shopify" in lower:      return "Shopify"
    if "meesho" in lower:       return "Meesho"
    return "Unknown"


def _safe_float(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return None


def _resolve_file_path(stored_path: str, filename: str) -> Optional[str]:
    """Handle stale/cross-machine absolute paths."""
    import glob
    if stored_path and os.path.exists(stored_path):
        return stored_path
    if stored_path:
        candidate = os.path.join(UPLOAD_DIR, os.path.basename(stored_path))
        if os.path.exists(candidate):
            return candidate
    if filename:
        matches = glob.glob(os.path.join(UPLOAD_DIR, f"*{filename}"))
        if matches:
            return matches[0]
        direct = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(direct):
            return direct
    return None


def _apply_mappings(df: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    rename = {src: tgt for src, tgt in col_map.items() if src in df.columns}
    if rename:
        df = df.rename(columns=rename)
    return df


def _apply_standardized_names(df: pd.DataFrame, std_map: dict) -> pd.DataFrame:
    if "product_name" not in df.columns:
        return df
    df = df.copy()
    df["product_name"] = df["product_name"].apply(
        lambda v: std_map.get(str(v).strip(), v) if pd.notna(v) else v
    )
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Build unified dataframe
# ─────────────────────────────────────────────────────────────────────────────

def _build_from_final_dataset() -> pd.DataFrame:
    """
    Read directly from the pre-built final_dataset table.
    Column names already match analytics expectations except platform → _platform.
    """
    conn = get_db_conn()
    try:
        rows = conn.execute("SELECT * FROM final_dataset").fetchall()
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame([dict(r) for r in rows])
        df = df.rename(columns={"platform": "_platform"})
        return df
    finally:
        conn.close()


def _build_unified_df() -> pd.DataFrame:
    """
    Return a unified DataFrame for analytics.

    Priority:
      1. If final_dataset has rows, read from there (includes all human edits:
         standardized product names, brand, category, sub_category overrides).
      2. Fall back to building in-memory from raw files + column mappings +
         product-name standardization (legacy path, no field overrides).
    """
    # ── Try final_dataset first ───────────────────────────────────────────────
    try:
        conn = get_db_conn()
        try:
            count = conn.execute("SELECT COUNT(*) FROM final_dataset").fetchone()[0]
        finally:
            conn.close()
        if count > 0:
            return _build_from_final_dataset()
    except Exception:
        pass  # table might not exist yet on first boot

    # ── Legacy in-memory build ────────────────────────────────────────────────
    uploads = get_all_uploads()
    std_map = _get_standardized_names()
    frames = []

    for upload in uploads:
        file_path = _resolve_file_path(
            upload.get("file_path", ""),
            upload.get("filename", "")
        )
        if not file_path:
            logger.warning(f"File not found for upload: {upload.get('filename')}")
            continue

        platform = _detect_platform(upload["filename"])
        df = _load_df(file_path, upload["filename"])
        if df is None:
            continue

        col_map = _get_column_mappings(platform)
        df = _apply_mappings(df, col_map)
        df = _apply_standardized_names(df, std_map)
        df["_platform"] = platform
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    unified = pd.concat(frames, ignore_index=True, sort=False)
    return unified


# ─────────────────────────────────────────────────────────────────────────────
# KPI computation
# ─────────────────────────────────────────────────────────────────────────────

def _coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series.astype(str).str.replace(",", "").str.strip(), errors="coerce")


def _compute_kpis(df: pd.DataFrame) -> dict:
    kpis = {}

    units_col = next((c for c in df.columns if c == "units_sold"), None)
    total_units = 0
    if units_col:
        units = _coerce_numeric(df[units_col]).fillna(0)
        total_units = int(units.sum())
    kpis["total_units_sold"] = total_units

    rev_col = next((c for c in df.columns if c == "invoice_value_incl_gst"), None)
    mrp_col = next((c for c in df.columns if c == "mrp"), None)
    total_revenue = 0.0
    if rev_col:
        rev = _coerce_numeric(df[rev_col]).fillna(0)
        total_revenue = float(rev.sum())
    elif mrp_col and units_col:
        mrp   = _coerce_numeric(df[mrp_col]).fillna(0)
        units_s = _coerce_numeric(df[units_col]).fillna(0)
        total_revenue = float((mrp * units_s).sum())
    elif mrp_col:
        total_revenue = float(_coerce_numeric(df[mrp_col]).fillna(0).sum())
    kpis["total_revenue"] = round(total_revenue, 2)

    kpis["avg_order_value"] = round(total_revenue / total_units, 2) if total_units > 0 and total_revenue > 0 else 0.0

    # ── Platform breakdown ────────────────────────────────────────────────────
    platform_col = "_platform"
    if platform_col in df.columns:
        if rev_col:
            channel_rev = df.groupby(platform_col)[rev_col].apply(
                lambda s: _coerce_numeric(s).fillna(0).sum()
            ).to_dict()
            channel_units = df.groupby(platform_col)[units_col].apply(
                lambda s: int(_coerce_numeric(s).fillna(0).sum())
            ).to_dict() if units_col else {}
        elif mrp_col and units_col:
            df2 = df.copy()
            df2["_line_rev"] = _coerce_numeric(df[mrp_col]).fillna(0) * _coerce_numeric(df[units_col]).fillna(0)
            channel_rev   = df2.groupby(platform_col)["_line_rev"].sum().to_dict()
            channel_units = df2.groupby(platform_col)[units_col].apply(
                lambda s: int(_coerce_numeric(s).fillna(0).sum())
            ).to_dict()
        else:
            channel_rev   = df.groupby(platform_col).size().to_dict()
            channel_units = channel_rev

        kpis["platform_breakdown"] = [
            {"platform": k, "revenue": round(float(v), 2), "units": channel_units.get(k, 0)}
            for k, v in sorted(channel_rev.items(), key=lambda x: -x[1])
        ]
        kpis["platforms"] = [p["platform"] for p in kpis["platform_breakdown"]]
    else:
        kpis["platform_breakdown"] = []
        kpis["platforms"] = []

    # ── Brand × Product breakdown ─────────────────────────────────────────────
    prod_col  = "product_name"
    brand_col = next((c for c in df.columns if c == "brand"), None)

    if prod_col in df.columns:
        df2 = df.copy()
        value_col = rev_col if rev_col else (mrp_col if mrp_col else None)
        if value_col:
            df2[value_col] = _coerce_numeric(df2[value_col]).fillna(0)
        if units_col:
            df2[units_col] = _coerce_numeric(df2[units_col]).fillna(0)

        group_cols = [prod_col]
        if brand_col:
            group_cols = [brand_col, prod_col]
        if platform_col in df2.columns:
            group_cols_with_platform = group_cols + [platform_col]
        else:
            group_cols_with_platform = group_cols

        agg = {}
        if value_col:
            agg["revenue"] = (value_col, "sum")
        if units_col:
            agg["units"] = (units_col, "sum")
        if not agg:
            agg["units"] = (prod_col, "count")

        grouped = df2.groupby(group_cols_with_platform).agg(**agg).reset_index()

        # Roll up to brand+product level (aggregate platforms for top-level numbers)
        rolled = df2.groupby(group_cols).agg(**agg).reset_index()
        rolled = rolled.sort_values("revenue" if "revenue" in rolled.columns else "units", ascending=False)

        brand_product_rows = []
        for _, row in rolled.iterrows():
            entry = {
                "product_name": str(row[prod_col]),
                "brand": str(row[brand_col]) if brand_col else "Unknown",
                "revenue": round(float(row.get("revenue", 0)), 2),
                "units": int(row.get("units", 0)),
            }
            # attach per-platform breakdown for this product
            mask = grouped[prod_col] == row[prod_col]
            if brand_col:
                mask = mask & (grouped[brand_col] == row[brand_col])
            plat_rows = grouped[mask]
            entry["platforms"] = {
                str(r[platform_col]): {
                    "revenue": round(float(r.get("revenue", 0)), 2),
                    "units": int(r.get("units", 0)),
                }
                for _, r in plat_rows.iterrows()
                if platform_col in r.index
            }
            brand_product_rows.append(entry)

        kpis["brand_product_breakdown"] = brand_product_rows
    else:
        kpis["brand_product_breakdown"] = []

    # ── Revenue by date ───────────────────────────────────────────────────────
    date_col = next((c for c in df.columns if c == "transaction_date"), None)
    if date_col and (rev_col or mrp_col):
        df2 = df.copy()
        df2["_date"] = pd.to_datetime(df2[date_col], errors="coerce", dayfirst=True)
        df2 = df2.dropna(subset=["_date"])
        value_col = rev_col if rev_col else mrp_col
        df2[value_col] = _coerce_numeric(df2[value_col]).fillna(0)
        if units_col:
            df2[units_col] = _coerce_numeric(df2[units_col]).fillna(0)

        agg_dict = {value_col: "sum"}
        if units_col:
            agg_dict[units_col] = "sum"

        daily = (
            df2.groupby(df2["_date"].dt.date)
            .agg(agg_dict)
            .reset_index()
            .rename(columns={"_date": "date", value_col: "revenue"})
            .sort_values("date")
        )
        kpis["revenue_by_date"] = [
            {
                "date": str(row["date"]),
                "revenue": round(float(row["revenue"]), 2),
                "units": int(row[units_col]) if units_col and units_col in row else 0,
            }
            for _, row in daily.iterrows()
        ]
    else:
        kpis["revenue_by_date"] = []

    sku_col = next((c for c in df.columns if c in ("sku_id", "product_name")), None)
    kpis["unique_skus"] = int(df[sku_col].nunique()) if sku_col else 0
    kpis["total_rows"] = len(df)

    return kpis


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/platforms")
def get_platforms():
    """Return distinct platform names available in uploaded data."""
    df = _build_unified_df()
    if df.empty or "_platform" not in df.columns:
        return {"platforms": []}
    return {"platforms": sorted(df["_platform"].dropna().unique().tolist())}


@router.get("/summary")
def analytics_summary(
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    date_to:   Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    platforms: Optional[str] = Query(None, description="Comma-separated platform names"),
):
    """
    Build the unified dataset and return KPIs.
    Supports date_from / date_to filtering and platform filtering.
    """
    df = _build_unified_df()

    if df.empty:
        return {
            "has_data": False,
            "message": "No data available. Upload files in Screen 1 and map columns in Screen 2.",
            "kpis": {},
        }

    # ── Date filter ───────────────────────────────────────────────────────────
    date_col = next((c for c in df.columns if c == "transaction_date"), None)
    date_filter_active = bool(date_col and (date_from or date_to))
    date_col_has_data = date_filter_active and df[date_col].notna().any()

    if date_filter_active and date_col_has_data:
        df["_date_parsed"] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True)
        if date_from:
            try:
                df = df[df["_date_parsed"] >= pd.Timestamp(date_from)]
            except Exception:
                pass
        if date_to:
            try:
                df = df[df["_date_parsed"] <= pd.Timestamp(date_to) + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)]
            except Exception:
                pass
        df = df.drop(columns=["_date_parsed"], errors="ignore")

    if df.empty:
        return {
            "has_data": False,
            "message": "No data found for the selected date range.",
            "kpis": {},
        }

    kpis = _compute_kpis(df)
    all_platforms = kpis.get("platforms", [])

    date_filter_warning = None
    if (date_from or date_to) and not date_col:
        date_filter_warning = "Date filter has no effect: no column is mapped to 'transaction_date' in Screen 2."
    elif (date_from or date_to) and not date_col_has_data:
        date_filter_warning = "Date filter has no effect: 'transaction_date' column contains no values."

    return {
        "has_data": True,
        "total_rows": kpis.get("total_rows", 0),
        "kpis": kpis,
        "all_platforms": all_platforms,
        "date_from": date_from,
        "date_to": date_to,
        "date_filter_warning": date_filter_warning,
    }
