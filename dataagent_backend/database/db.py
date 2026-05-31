"""
database/db.py
===============
SQLite database — creates dataagent.db and the uploads table.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "dataagent.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS uploads (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                filename     TEXT    NOT NULL,
                saved_as     TEXT    NOT NULL,
                file_path    TEXT    NOT NULL,
                file_type    TEXT    NOT NULL,
                file_size_kb REAL    NOT NULL,
                row_count    INTEGER DEFAULT 0,
                col_count    INTEGER DEFAULT 0,
                col_names    TEXT    DEFAULT '',
                status       TEXT    DEFAULT 'uploaded',
                uploaded_at  TEXT    NOT NULL,
                error_msg    TEXT    DEFAULT ''
            )
        """)
        conn.commit()
    print("✓ Database ready — dataagent.db")


def get_all_uploads() -> list:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM uploads ORDER BY uploaded_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_upload_by_id(upload_id: int):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM uploads WHERE id = ?", (upload_id,)
        ).fetchone()
        return dict(row) if row else None


def insert_upload(record: dict) -> int:
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO uploads
              (filename, saved_as, file_path, file_type, file_size_kb,
               row_count, col_count, col_names, status, uploaded_at, error_msg)
            VALUES
              (:filename, :saved_as, :file_path, :file_type, :file_size_kb,
               :row_count, :col_count, :col_names, :status, :uploaded_at, :error_msg)
        """, record)
        conn.commit()
        return cursor.lastrowid


def update_upload_status(upload_id: int, status: str, error_msg: str = ""):
    with get_connection() as conn:
        conn.execute(
            "UPDATE uploads SET status = ?, error_msg = ? WHERE id = ?",
            (status, error_msg, upload_id)
        )
        conn.commit()


def delete_upload(upload_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM uploads WHERE id = ?", (upload_id,)
        )
        conn.commit()
        return cursor.rowcount > 0


# ─────────────────────────────────────────────────────────────────────────────
# Upload ↔ Column link tracking  (for cascading deletion)
# ─────────────────────────────────────────────────────────────────────────────

def init_upload_column_links():
    """
    Junction table: records which upload contributed which (source_column, platform)
    pairs.  Used to determine orphaned mappings when a file is deleted.
    """
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS upload_column_links (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                upload_id     INTEGER NOT NULL,
                source_column TEXT    NOT NULL,
                platform      TEXT    NOT NULL,
                UNIQUE(upload_id, source_column, platform)
            )
        """)
        conn.commit()


def insert_upload_column_links(upload_id: int, columns: list, platform: str):
    """Record that upload_id contributed these columns for platform."""
    with get_connection() as conn:
        for col in columns:
            conn.execute(
                """INSERT OR IGNORE INTO upload_column_links
                   (upload_id, source_column, platform) VALUES (?, ?, ?)""",
                (upload_id, col, platform),
            )
        conn.commit()


def delete_upload_column_links(upload_id: int) -> list:
    """
    Remove link rows for upload_id and return orphaned (source_column, platform)
    pairs — those that no longer appear in ANY remaining upload.
    """
    with get_connection() as conn:
        # Fetch the columns this upload owned
        owned = conn.execute(
            "SELECT source_column, platform FROM upload_column_links WHERE upload_id = ?",
            (upload_id,),
        ).fetchall()

        # Delete the links for this upload
        conn.execute(
            "DELETE FROM upload_column_links WHERE upload_id = ?", (upload_id,)
        )
        conn.commit()

        # Find which of those columns are now orphaned (no other upload references them)
        orphaned = []
        for row in owned:
            remaining = conn.execute(
                """SELECT 1 FROM upload_column_links
                   WHERE source_column = ? AND platform = ? LIMIT 1""",
                (row["source_column"], row["platform"]),
            ).fetchone()
            if not remaining:
                orphaned.append(
                    {"source_column": row["source_column"], "platform": row["platform"]}
                )
        return orphaned


def get_remaining_upload_ids() -> list:
    """Return all upload IDs still present in the uploads table."""
    with get_connection() as conn:
        rows = conn.execute("SELECT id FROM uploads").fetchall()
        return [r["id"] for r in rows]
