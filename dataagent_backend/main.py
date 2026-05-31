"""
main.py
========
FastAPI server entry point — DataAgent (Ingestion + Mapping + Standardization).

Run with:
  uvicorn main:app --reload --port 8000

Then test at:
  http://localhost:8000/docs
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.db import init_db, init_upload_column_links
from agents.agent1.mapping import init_mapping_tables
from agents.agent1.standardizer import init_standardize_table, init_standardize_fields_table
from agents.agent1.final_builder import init_final_dataset_table

from routers import agent1_ingest
from routers import agent1_mapping
from agents.agent1.mapping import router as mapping_core_router
from routers import agent1_standardize
from routers import analytics as analytics_router
from routers.auth import router as auth_router, init_auth_tables   # ← NEW


# ── Lifespan: DB setup on startup ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n Starting DataAgent backend...")

    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    print(f"✓ Uploads folder ready — {uploads_dir}")

    init_db()
    print("✓ uploads table ready")

    init_upload_column_links()
    print("✓ upload_column_links table ready")

    init_mapping_tables()
    print("✓ column_mappings + mapping_targets tables ready")

    init_standardize_table()
    print("✓ standardized_products table ready")

    init_standardize_fields_table()
    print("✓ standardized_fields table ready")

    init_auth_tables()                                              # ← NEW
    print("✓ users + sessions tables ready")

    init_final_dataset_table()
    print("✓ final_dataset table ready")

    # ── Backfill upload_column_links for existing uploads ────────────────────
    try:
        from database.db import get_all_uploads, insert_upload_column_links
        from agents.agent1.mapping import detect_platform
        uploads = get_all_uploads()
        backfilled = 0
        for u in uploads:
            col_names_str = u.get("col_names", "")
            if not col_names_str:
                continue
            cols = [c.strip() for c in col_names_str.split(",") if c.strip()]
            if cols:
                platform = detect_platform(u["filename"])
                insert_upload_column_links(u["id"], cols, platform)
                backfilled += 1
        if backfilled:
            print(f"✓ Backfilled upload_column_links for {backfilled} existing upload(s)")
    except Exception as e:
        print(f"⚠ Backfill upload_column_links failed (non-fatal): {e}")

    print("✓ Server ready — visit http://localhost:8000/docs to test all routes\n")

    yield

    print("\nShutting down DataAgent backend.")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "DataAgent — Full Pipeline API",
    description = (
        "Handles file uploads (Screen 1), column mapping (Screen 2), "
        "and product name standardization (Screen 3)."
    ),
    version     = "2.0.0",
    lifespan    = lifespan,
)

# Allow both Vite dev server ports
app.add_middleware(
    CORSMiddleware,
    allow_origins  = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://content-abundance-production-5029.up.railway.app",
    ],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
    allow_credentials = True,                                       # ← needed for cookies
)

# ── Auth ───────────────────────────────────────────────────────────────────────
app.include_router(
    auth_router,
    prefix = "/api/auth",
    tags   = ["Authentication"],
)

# ── Screen 1 — Data Ingestion ──────────────────────────────────────────────────
app.include_router(
    agent1_ingest.router,
    prefix = "/api/ingest",
    tags   = ["Screen 1 — Data Ingestion"],
)

# ── Screen 2 — Column Mapping (core CRUD from agents/agent1/mapping.py) ────────
app.include_router(
    mapping_core_router,
    tags=["Screen 2 — Column Mapping"],
)

# ── Screen 2 — Column Mapping (extra endpoints: /platforms, /refresh) ──────────
app.include_router(
    agent1_mapping.router,
    prefix = "/api/mapping",
    tags   = ["Screen 2 — Column Mapping"],
)

# ── Screen 3 — Product Standardization ────────────────────────────────────────
app.include_router(
    agent1_standardize.router,
    prefix = "/api/standardize",
    tags   = ["Screen 3 — Product Standardization"],
)


# ── Screen 4 — Analytics Dashboard ────────────────────────────────────────────
app.include_router(
    analytics_router.router,
    prefix = "/api/analytics",
    tags   = ["Screen 4 — Analytics"],
)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    return {
        "status"  : "running",
        "message" : "DataAgent API v2 is live.",
        "docs"    : "http://localhost:8000/docs",
        "screens" : {
            "ingestion"       : "/api/ingest",
            "mapping"         : "/api/mapping",
            "standardization" : "/api/standardize",
        },
    }
