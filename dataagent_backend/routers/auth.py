"""
routers/auth.py
================
Authentication router — login, logout, session check.

Users are pre-registered by an admin directly in the SQLite DB.
No public sign-up endpoint is exposed.

Session is managed via a signed HTTP-only cookie (simple token stored in
the `sessions` table).  No external JWT library required.
"""

import os
import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, Cookie
from pydantic import BaseModel

# ── DB path (same dataagent.db used by the rest of the app) ──────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "dataagent.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── Table initialisation (called from main.py lifespan) ─────────────────────

def init_auth_tables():
    with get_conn() as conn:
        # users — pre-populated by admin, no public registration
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                username     TEXT    NOT NULL UNIQUE,
                password_hash TEXT   NOT NULL,
                full_name    TEXT    DEFAULT '',
                role         TEXT    DEFAULT 'official',
                created_at   TEXT    NOT NULL
            )
        """)
        # sessions — one row per active session
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token      TEXT    PRIMARY KEY,
                user_id    INTEGER NOT NULL,
                username   TEXT    NOT NULL,
                expires_at TEXT    NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        conn.commit()

    # Seed a default admin if the table is empty
    _seed_default_user()
    print("✓ users + sessions tables ready")


def _hash_password(password: str) -> str:
    """SHA-256 hash with a fixed app-level salt.  Replace with bcrypt for prod."""
    salt = "dataagent_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _seed_default_user():
    """Insert a default admin account only if no users exist yet."""
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            conn.execute(
                """INSERT INTO users (username, password_hash, full_name, role, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    "admin",
                    _hash_password("admin123"),
                    "Administrator",
                    "admin",
                    datetime.utcnow().isoformat(),
                ),
            )
            conn.commit()
            print("✓ Default user seeded — username: admin / password: admin123")


# ── Helper: register a user programmatically (call from a migration script) ──

def register_user(username: str, password: str, full_name: str = "", role: str = "official"):
    """
    Add a pre-registered official.  Call this from a one-off admin script,
    NOT from an HTTP endpoint.
    """
    with get_conn() as conn:
        try:
            conn.execute(
                """INSERT INTO users (username, password_hash, full_name, role, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (username, _hash_password(password), full_name, role, datetime.utcnow().isoformat()),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f"Username '{username}' already exists.")


# ── Session helpers ──────────────────────────────────────────────────────────

SESSION_TTL_HOURS = 8
COOKIE_NAME = "da_session"


def _create_session(user_id: int, username: str) -> str:
    token = secrets.token_hex(32)
    expires = (datetime.utcnow() + timedelta(hours=SESSION_TTL_HOURS)).isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, username, expires),
        )
        conn.commit()
    return token


def _validate_session(token: str) -> Optional[dict]:
    """Return user info dict if session is valid and not expired, else None."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if not row:
            return None
        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None
        user = conn.execute(
            "SELECT id, username, full_name, role FROM users WHERE id = ?",
            (row["user_id"],),
        ).fetchone()
        return dict(user) if user else None


def _delete_session(token: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


# ── Router ───────────────────────────────────────────────────────────────────

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, response: Response):
    """Validate credentials and issue a session cookie."""
    with get_conn() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (body.username.strip(),)
        ).fetchone()

    if not user or user["password_hash"] != _hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = _create_session(user["id"], user["username"])

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=SESSION_TTL_HOURS * 3600,
        path="/",
    )

    return {
        "success": True,
        "user": {
            "id":        user["id"],
            "username":  user["username"],
            "full_name": user["full_name"],
            "role":      user["role"],
        },
    }


@router.post("/logout")
def logout(response: Response, da_session: Optional[str] = Cookie(default=None)):
    """Invalidate the current session."""
    if da_session:
        _delete_session(da_session)
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"success": True, "message": "Logged out."}


@router.get("/session")
def check_session(da_session: Optional[str] = Cookie(default=None)):
    """Return current user info if a valid session exists."""
    if not da_session:
        raise HTTPException(status_code=401, detail="No session.")
    user = _validate_session(da_session)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    return {"authenticated": True, "user": user}
