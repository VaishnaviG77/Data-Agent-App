"""
routers/agent1_standardize.py
==============================
FastAPI routes for Screen 3 — Product Standardization Engine.

Routes:
  GET    /api/standardize/products          → list standardized products
  POST   /api/standardize/run               → (re)run AI standardization on all uploads
  POST   /api/standardize/override/{id}     → manual override for a single record
  GET    /api/standardize/stats             → summary stats (total, high/med/low confidence)
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.agent1.final_builder import build_final_dataset
from agents.agent1.standardizer import (
    run_standardization_for_all,
    get_all_standardized,
    override_standardized_name,
    override_standardized_names_batch,
    override_standardized_fields_batch,
    get_standardization_stats,
    get_llm_suggestion,
    generate_synonym_suggestion,
    get_field_suggestions,
    purge_stale_standardized_products,
    run_standardization_fields,
    get_all_standardized_fields,
    override_standardized_field,
    get_standardization_stats_fields,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────────

class StandardizedProduct(BaseModel):
    id: int
    original_name: str
    standardized_name: str
    confidence: int
    platform: str
    status: str
    occurrence_count: int = 1

class OverrideRequest(BaseModel):
    standardized_name: str


class RunResponse(BaseModel):
    processed: int
    message: str


class StatsResponse(BaseModel):
    total: int
    high_confidence: int    # >= 90
    medium_confidence: int  # 70–89
    low_confidence: int     # < 70


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[StandardizedProduct])
def list_products(platform: Optional[str] = None, needs_review: bool = False):
    """
    Return all standardized product rows.
    Optional filters:
      ?platform=Shopify   – filter by source platform
      ?needs_review=true  – only return confidence < 80
    """
    rows = get_all_standardized(platform=platform, needs_review=needs_review)
    return rows


@router.post("/run", response_model=RunResponse)
def run_standardization():
    """
    Trigger the standardization pass over all uploaded product data.
    Reads from `uploads` table, writes to `standardized_products`.
    Safe to call multiple times — uses INSERT OR REPLACE.
    Also rebuilds final_dataset so analytics stays current.
    """
    count = run_standardization_for_all()
    try:
        build_final_dataset()
    except Exception as e:
        logger.warning(f"final_dataset rebuild after /run failed (non-fatal): {e}")
    return RunResponse(
        processed=count,
        message=f"Standardization complete — {count} product name(s) processed.",
    )


@router.post("/override/{product_id}", response_model=StandardizedProduct)
def manual_override(product_id: int, body: OverrideRequest):
    """
    Save a human-edited standardized name for a product.
    Rebuilds final_dataset so the edit propagates to all analytics rows
    that share this original_name.
    """
    if not body.standardized_name.strip():
        raise HTTPException(status_code=400, detail="standardized_name cannot be empty.")

    updated = override_standardized_name(product_id, body.standardized_name.strip())
    if not updated:
        raise HTTPException(status_code=404, detail=f"No product found with id {product_id}.")
    try:
        build_final_dataset()
    except Exception as e:
        logger.warning(f"final_dataset rebuild after override failed (non-fatal): {e}")
    return updated


# @router.get("/stats", response_model=StatsResponse)
@router.get("/stats", response_model=StatsResponse)
def standardization_stats():
    """Return confidence-band counts for the dashboard cards."""
    return get_standardization_stats()


class SuggestRequest(BaseModel):
    product_name: str
    api_key: str
    provider: str = "groq"
    platform: str = None


class TaxonomyDetail(BaseModel):
    brand: Optional[str] = None
    main_category: Optional[str] = None
    sub_type: Optional[str] = None
    size: Optional[float] = None
    unit: Optional[str] = None
    container: Optional[str] = None
    confidence: float = 0.5


class SynonymSuggestion(BaseModel):
    standardized_name: str
    confidence: int
    taxonomy: TaxonomyDetail


class SuggestResponse(BaseModel):
    standardized_name: str
    confidence: int
    taxonomy: TaxonomyDetail
    synonym_suggestion: Optional[SynonymSuggestion] = None


@router.post("/suggest")
def suggest_standardized_name(body: SuggestRequest):
    """
    Call OpenAI to get an AI suggestion for ONE product name.
    Also returns a synonym_suggestion derived purely from synonym_config.json.
    Does NOT write to DB — returns suggestion for the user to review and commit.
    """
    if not body.api_key.strip():
        raise HTTPException(status_code=400, detail="api_key is required.")
    try:
        result = get_llm_suggestion(
            product_name=body.product_name,
            api_key=body.api_key.strip(),
            provider=body.provider,
            platform=body.platform,
        )
        return result
    except Exception as e:
        logger.error(f"LLM suggest failed for '{body.product_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SynonymOnlyRequest(BaseModel):
    product_name: str
    platform: str = None


class FieldSuggestRequest(BaseModel):
    value: str
    field_type: str   # "brand" | "category" | "sub_category"


@router.post("/suggest-field")
def suggest_field_value(body: FieldSuggestRequest):
    """
    Return synonym-config suggestions for a single brand/category/sub_category value.
    No API key needed — uses only the synonym_config.json vocabulary.
    Returns a list of {name, confidence, source} chips.
    """
    if body.field_type not in VALID_FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"field_type must be one of {VALID_FIELD_TYPES}")
    if not body.value.strip():
        raise HTTPException(status_code=400, detail="value cannot be empty.")
    suggestions = get_field_suggestions(body.value.strip(), body.field_type)
    return {"suggestions": suggestions}


@router.post("/suggest-synonym")
def suggest_synonym_only(body: SynonymOnlyRequest):
    """
    Generate a suggestion using ONLY the synonym_config.json vocabulary.
    No API key required — useful as a fallback or standalone suggestion.
    """
    if not body.product_name.strip():
        raise HTTPException(status_code=400, detail="product_name cannot be empty.")
    result = generate_synonym_suggestion(body.product_name.strip(), platform=body.platform)
    return result


# ── Generic field standardization (brand / category / sub_category) ────────────

VALID_FIELD_TYPES = {"brand", "category", "sub_category"}


class StandardizedField(BaseModel):
    id: int
    field_type: str
    original_value: str
    standardized_value: str
    confidence: int
    platform: str
    status: str
    occurrence_count: int = 1


class FieldOverrideRequest(BaseModel):
    standardized_value: str


@router.get("/fields", response_model=list[StandardizedField])
def list_fields(field_type: str):
    """Return all standardized rows for brand, category, or sub_category."""
    if field_type not in VALID_FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"field_type must be one of {VALID_FIELD_TYPES}")
    return get_all_standardized_fields(field_type)


@router.post("/run-fields")
def run_fields_standardization(field_type: str):
    """
    Trigger standardization for brand, category, or sub_category across all uploads.
    Also rebuilds final_dataset so analytics reflects the updated field values.
    """
    if field_type not in VALID_FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"field_type must be one of {VALID_FIELD_TYPES}")
    count = run_standardization_fields(field_type)
    try:
        build_final_dataset()
    except Exception as e:
        logger.warning(f"final_dataset rebuild after run-fields failed (non-fatal): {e}")
    return {"processed": count, "message": f"Standardization complete — {count} unique '{field_type}' values processed."}


@router.post("/override-field/{field_id}", response_model=StandardizedField)
def manual_override_field(field_id: int, body: FieldOverrideRequest):
    """
    Save a human-edited standardized value for a brand/category/sub_category entry.
    Rebuilds final_dataset so all rows that match this original_value are updated.
    """
    if not body.standardized_value.strip():
        raise HTTPException(status_code=400, detail="standardized_value cannot be empty.")
    updated = override_standardized_field(field_id, body.standardized_value.strip())
    if not updated:
        raise HTTPException(status_code=404, detail=f"No field entry found with id {field_id}.")
    try:
        build_final_dataset()
    except Exception as e:
        logger.warning(f"final_dataset rebuild after override-field failed (non-fatal): {e}")
    return updated


class BatchProductOverrideRequest(BaseModel):
    ids: list[int]
    standardized_name: str


class BatchFieldOverrideRequest(BaseModel):
    ids: list[int]
    standardized_value: str


@router.post("/override-batch")
def batch_override_products(body: BatchProductOverrideRequest):
    """
    Update standardized_name for a batch of product rows at once.
    Used when the frontend groups rows by standardized_name and the user
    edits the canonical form — the edit must apply to every original_name
    in the group.
    """
    if not body.standardized_name.strip():
        raise HTTPException(status_code=400, detail="standardized_name cannot be empty.")
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids list cannot be empty.")
    count = override_standardized_names_batch(body.ids, body.standardized_name.strip())
    try:
        build_final_dataset()
    except Exception as e:
        logger.warning(f"final_dataset rebuild after override-batch failed (non-fatal): {e}")
    return {"updated": count, "standardized_name": body.standardized_name.strip()}


@router.post("/override-field-batch")
def batch_override_fields(body: BatchFieldOverrideRequest):
    """
    Update standardized_value for a batch of field rows at once.
    Used when the frontend groups rows by standardized_value for
    brand / category / sub_category.
    """
    if not body.standardized_value.strip():
        raise HTTPException(status_code=400, detail="standardized_value cannot be empty.")
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids list cannot be empty.")
    count = override_standardized_fields_batch(body.ids, body.standardized_value.strip())
    try:
        build_final_dataset()
    except Exception as e:
        logger.warning(f"final_dataset rebuild after override-field-batch failed (non-fatal): {e}")
    return {"updated": count, "standardized_value": body.standardized_value.strip()}


@router.post("/build-final")
def trigger_build_final():
    """
    Manually trigger a full rebuild of final_dataset.
    Useful after bulk uploads or to sync analytics with latest standardization edits.
    """
    try:
        rows = build_final_dataset()
        return {"rows_written": rows, "message": f"final_dataset rebuilt — {rows} rows written."}
    except Exception as e:
        logger.error(f"build-final failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats-fields", response_model=StatsResponse)
def standardization_stats_fields(field_type: str):
    """Return confidence-band counts for a specific field type."""
    if field_type not in VALID_FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"field_type must be one of {VALID_FIELD_TYPES}")
    return get_standardization_stats_fields(field_type)
# def suggest_standardized_name(body: SuggestRequest):
#     """
#     Call TaxonomyAgent (LLM) to get an AI suggestion for ONE product name.
#     Does NOT write to DB — just returns the suggestion for the user to review.
#     The user must click Commit to actually save it (via /override/{id}).
#     """
#     if not body.api_key.strip():
#         raise HTTPException(status_code=400, detail="api_key is required.")
#     try:
#         result = get_llm_suggestion(body.product_name, body.api_key.strip(), body.provider)
#         return result
#     except Exception as e:
#         logger.error(f"LLM suggest failed for '{body.product_name}': {e}")
#         raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")
    
# class SuggestRequest(BaseModel):
#     product_name: str
#     api_key: str
#     provider: str = "groq"


# class SuggestResponse(BaseModel):
#     standardized_name: str
#     confidence: int
#     taxonomy: dict


# @router.post("/suggest", response_model=SuggestResponse)
# def suggest_standardized_name(body: SuggestRequest):
#     """
#     Call TaxonomyAgent (LLM) to get an AI suggestion for a single product name.
#     Requires api_key from the frontend settings panel.
#     """
#     from agents.agent1.standardizer import get_llm_suggestion
#     if not body.api_key.strip():
#         raise HTTPException(status_code=400, detail="api_key is required.")
#     try:
#         result = get_llm_suggestion(body.product_name, body.api_key, body.provider)
#         return SuggestResponse(**result)
#     except Exception as e:
#         logger.error(f"LLM suggest failed: {e}")
#         raise HTTPException(status_code=500, detail=str(e))