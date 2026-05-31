"""
agents/agent1/data_loader.py
==============================
Reads uploaded files and extracts metadata.
"""

import io
import json
import pandas as pd


ALLOWED_EXTENSIONS = {".csv", ".xls", ".xlsx", ".json"}
MAX_PREVIEW_ROWS = 5


def load_file(file_contents: bytes, filename: str) -> dict:
    extension = _get_extension(filename)

    try:
        if extension == ".csv":
            df = _read_csv(file_contents)
        elif extension in (".xls", ".xlsx"):
            df = _read_excel(file_contents)
        elif extension == ".json":
            df = _read_json(file_contents)
        else:
            return _error_result(f"Unsupported file type: {extension}")
    except Exception as e:
        return _error_result(f"Could not read file: {str(e)}")

    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")

    if len(df) == 0:
        return _error_result("File appears to be empty after reading.")

    return {
        "row_count" : len(df),
        "col_count" : len(df.columns),
        "col_names" : list(df.columns),
        "preview"   : _safe_preview(df),
        "file_type" : extension.lstrip("."),
        "error"     : None,
    }


def _read_csv(contents: bytes) -> pd.DataFrame:
    try:
        return pd.read_csv(io.BytesIO(contents), encoding="utf-8")
    except UnicodeDecodeError:
        return pd.read_csv(io.BytesIO(contents), encoding="latin-1")


def _read_excel(contents: bytes) -> pd.DataFrame:
    return pd.read_excel(io.BytesIO(contents), sheet_name=0)


def _read_json(contents: bytes) -> pd.DataFrame:
    data = json.loads(contents.decode("utf-8"))

    if isinstance(data, list):
        return pd.DataFrame(data)

    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, list):
                return pd.DataFrame(value)
        return pd.DataFrame([data])

    raise ValueError("JSON must be an array of objects or an object containing an array.")


# def _safe_preview(df: pd.DataFrame) -> list:
#     preview_df = df.head(MAX_PREVIEW_ROWS).where(pd.notnull(df.head(MAX_PREVIEW_ROWS)), None)
#     return preview_df.to_dict(orient="records")

import math

def _safe_preview(df: pd.DataFrame) -> list:
    preview_df = df.head(MAX_PREVIEW_ROWS)
    records = preview_df.to_dict(orient="records")
    
    def clean_value(v):
        if v is None:
            return None
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v
    
    return [
        {k: clean_value(v) for k, v in row.items()}
        for row in records
    ]


def _get_extension(filename: str) -> str:
    parts = filename.lower().rsplit(".", 1)
    return f".{parts[-1]}" if len(parts) == 2 else ""


def _error_result(message: str) -> dict:
    return {
        "row_count" : 0,
        "col_count" : 0,
        "col_names" : [],
        "preview"   : [],
        "file_type" : "",
        "error"     : message,
    }
