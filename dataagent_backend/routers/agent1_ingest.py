"""
routers/agent1_ingest.py
=========================
FastAPI routes for the Data Ingestion step.

Routes:
  POST   /api/ingest/upload       → upload files, save to disk + SQLite
  GET    /api/ingest/files        → list all uploaded files
  GET    /api/ingest/files/{id}   → get one file's details + schema
  DELETE /api/ingest/files/{id}   → delete file record + file on disk
"""

import os
import shutil
from datetime import datetime
import logging

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from agents.agent1.data_loader import load_file, ALLOWED_EXTENSIONS
from agents.agent1.mapping import populate_unmapped_columns, detect_platform, delete_orphaned_mappings
from agents.agent1.standardizer import run_standardization_for_all, purge_stale_standardized_products
from database.db import (
    insert_upload, get_all_uploads, get_upload_by_id, delete_upload,
    insert_upload_column_links, delete_upload_column_links,
)

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


# ── Route 1: Upload one or more files ─────────────────────────────────────────

@router.post("/upload", summary="Upload one or more files (CSV, Excel, JSON)")
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    failed  = []

    for file in files:
        result = await _process_single_file(file)
        if result.get("error"):
            failed.append({"filename": file.filename, "error": result["error"]})
        else:
            results.append(result)

    return {
        "uploaded" : len(results),
        "failed"   : len(failed),
        "results"  : results,
        "errors"   : failed,
    }


# ── Route 2: Get all uploaded files ───────────────────────────────────────────

@router.get("/files", summary="Get all uploaded files")
def list_files():
    files = get_all_uploads()
    return {
        "count" : len(files),
        "files" : files,
    }


# ── Route 3: Get one file by ID (includes schema/col_names for Mapping tab) ───

@router.get("/files/{upload_id}", summary="Get details of one uploaded file")
def get_file(upload_id: int):
    record = get_upload_by_id(upload_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"No upload found with id {upload_id}")

    # Parse col_names from comma-separated string back to list for frontend
    col_names_str = record.get("col_names", "")
    record["col_names_list"] = [c.strip() for c in col_names_str.split(",") if c.strip()] if col_names_str else []

    return record


# ── Route 4: Delete a file ─────────────────────────────────────────────────────

@router.delete("/files/{upload_id}", summary="Delete an uploaded file")
def delete_file(upload_id: int):
    record = get_upload_by_id(upload_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"No upload found with id {upload_id}")

    # ── 1. Delete physical file ──────────────────────────────────────────────
    file_path = record["file_path"]
    if os.path.exists(file_path):
        os.remove(file_path)

    # ── 2. Delete the uploads row ────────────────────────────────────────────
    delete_upload(upload_id)

    # ── 3. Cascade: remove column links and purge orphaned mappings ──────────
    orphaned_mappings_deleted = 0
    try:
        orphaned = delete_upload_column_links(upload_id)
        orphaned_mappings_deleted = delete_orphaned_mappings(orphaned)
    except Exception as e:
        logger.warning(f"Cascade mapping cleanup failed for upload {upload_id}: {e}")

    # ── 4. Cascade: purge standardized products no longer in any file ────────
    standardized_purged = 0
    try:
        standardized_purged = purge_stale_standardized_products()
    except Exception as e:
        logger.warning(f"Cascade standardization cleanup failed for upload {upload_id}: {e}")

    return {
        "deleted"  : True,
        "id"       : upload_id,
        "filename" : record["filename"],
        "cascade"  : {
            "orphaned_mappings_deleted"  : orphaned_mappings_deleted,
            "standardized_products_purged": standardized_purged,
        },
    }


# ── Private helper ─────────────────────────────────────────────────────────────

async def _process_single_file(file: UploadFile) -> dict:
    filename  = file.filename or "unknown_file"
    extension = _get_extension(filename)

    if extension not in ALLOWED_EXTENSIONS:
        return {
            "filename" : filename,
            "error"    : f"File type '{extension}' not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        }

    contents = await file.read()

    if len(contents) == 0:
        return {"filename": filename, "error": "File is empty."}

    file_size_kb = round(len(contents) / 1024, 2)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    saved_as  = f"{timestamp}_{filename}"
    file_path = os.path.join(UPLOAD_DIR, saved_as)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(contents)

    file_info   = load_file(contents, filename)
    uploaded_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if file_info["error"]:
        record = {
            "filename"    : filename,
            "saved_as"    : saved_as,
            "file_path"   : file_path,
            "file_type"   : extension.lstrip("."),
            "file_size_kb": file_size_kb,
            "row_count"   : 0,
            "col_count"   : 0,
            "col_names"   : "",
            "status"      : "error",
            "uploaded_at" : uploaded_at,
            "error_msg"   : file_info["error"],
        }
        new_id = insert_upload(record)
        return {**record, "id": new_id, "error": file_info["error"]}

    record = {
        "filename"    : filename,
        "saved_as"    : saved_as,
        "file_path"   : file_path,
        "file_type"   : file_info["file_type"],
        "file_size_kb": file_size_kb,
        "row_count"   : file_info["row_count"],
        "col_count"   : file_info["col_count"],
        "col_names"   : ", ".join(file_info["col_names"]),
        "status"      : "uploaded",
        "uploaded_at" : uploaded_at,
        "error_msg"   : "",
    }
    new_id = insert_upload(record)

    # ── Post-ingest hooks ────────────────────────────────────────────────────
    # Record which columns this upload contributed (for cascading deletion)
    try:
        platform = detect_platform(filename)
        insert_upload_column_links(new_id, file_info["col_names"], platform)
    except Exception as e:
        logger.warning(f"insert_upload_column_links failed for {filename}: {e}")

    # Screen 2: register every column in column_mappings (status=missing default)
    try:
        populate_unmapped_columns(filename, file_info["col_names"])
    except Exception as e:
        logger.warning(f"populate_unmapped_columns failed for {filename}: {e}")

    # Screen 3: run standardisation (best-effort, synchronous for simplicity)
    try:
        run_standardization_for_all()
    except Exception as e:
        logger.warning(f"run_standardization_for_all failed for {filename}: {e}")

    try:
        from agents.agent1.standardizer import run_standardization_fields
        for ft in ("brand", "category", "sub_category"):
            run_standardization_fields(ft)
    except Exception as e:
        logger.warning(f"run_standardization_fields failed for {filename}: {e}")

    return {
        "id"          : new_id,
        "filename"    : filename,
        "saved_as"    : saved_as,
        "file_type"   : file_info["file_type"],
        "file_size_kb": file_size_kb,
        "row_count"   : file_info["row_count"],
        "col_count"   : file_info["col_count"],
        "col_names"   : file_info["col_names"],
        "preview"     : file_info["preview"],
        "status"      : "uploaded",
        "uploaded_at" : uploaded_at,
        "error"       : None,
    }


def _get_extension(filename: str) -> str:
    parts = filename.lower().rsplit(".", 1)
    return f".{parts[-1]}" if len(parts) == 2 else ""
