"""
routers/agent1_mapping.py
==========================
FastAPI routes for Screen 2 — Column Mapping & Cleaning.

Routes:
  GET    /api/mapping/rows               → all mapping rows (optional ?platform=X)
  GET    /api/mapping/targets            → available standard target field names
  GET    /api/mapping/platforms          → distinct platforms that have mappings
  POST   /api/mapping/apply              → save manual mappings from HITL sidebar
  POST   /api/mapping/refresh            → re-run auto-detect for all uploaded files
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from agents.agent1.mapping import (
    router as mapping_router,          # the router defined in mapping.py
    init_mapping_tables,
    populate_mappings_for_file,
    populate_unmapped_columns,
    detect_platform,
    delete_orphaned_mappings,
    _get_db,
)
from agents.agent1.data_loader import load_file
from database.db import get_all_uploads

import os

logger = logging.getLogger(__name__)

# We re-export the existing router from mapping.py wholesale.
# Any additional routes go on a fresh router and both get included in main.py.
router = APIRouter()


# ── Extra endpoint: list distinct platforms ────────────────────────────────────

@router.get("/platforms", tags=["mapping"])
def get_platforms():
    """
    Return distinct platform names that have at least one mapping row.
    Used by Screen 2's tab filter (All | Shopify | Amazon | …).
    """
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT DISTINCT platform FROM column_mappings ORDER BY platform"
        ).fetchall()
        platforms = ["All"] + [r["platform"] for r in rows]
        return {"platforms": platforms}
    finally:
        conn.close()


# ── Extra endpoint: re-detect mappings for all uploads ────────────────────────

@router.post("/refresh", tags=["mapping"])
def refresh_mappings():
    """
    Re-run auto column-detection on every uploaded file in the DB.
    Idempotent — uses INSERT OR IGNORE / ON CONFLICT DO UPDATE.
    """
    uploads = get_all_uploads()
    processed = 0

    for upload in uploads:
        file_path = upload.get("file_path", "")
        filename  = upload.get("filename", "")
        col_names_str = upload.get("col_names", "")

        if not col_names_str:
            continue

        raw_columns = [c.strip() for c in col_names_str.split(",") if c.strip()]
        if not raw_columns:
            continue

        # Build a trivial identity mapping (source → same name as target candidate)
        # mapping.py's auto_detect_mapping is not exposed here, so we do the
        # simplest useful thing: every column starts as "missing" unless it
        # exactly matches a known target field (handled inside populate_unmapped_columns).
        populate_unmapped_columns(filename, raw_columns)
        processed += 1

    return {"refreshed": processed, "message": f"{processed} file(s) re-scanned."}
