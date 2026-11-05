import sqlite3
from collections.abc import Iterator
from pathlib import Path

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'staff',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
"""


def connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    """Open a connection with row access by column name and foreign keys on."""
    path = str(db_path) if db_path is not None else get_settings().db_path
    # Each request opens its own connection, but FastAPI may run a sync
    # dependency and the endpoint on different threadpool threads.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Create any missing tables. Safe to call repeatedly."""
    conn.executescript(SCHEMA)
    conn.commit()


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request, always closed."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
