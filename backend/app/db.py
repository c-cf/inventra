import logging
import sqlite3
from collections.abc import Iterator
from pathlib import Path

from app.config import get_settings

SCHEMA_PATH = Path(__file__).with_name("schema.sql")

logger = logging.getLogger(__name__)

# SKUs and usernames are identifiers people type: "kb-001" and "KB-001" (or "carol"
# and "CAROL") must not both exist. The columns' UNIQUE constraints compare
# case-sensitively, so these indexes add the rule. NOCASE folds ASCII letters only.
NOCASE_UNIQUE_INDEXES: tuple[tuple[str, str, str], ...] = (
    ("products_sku_nocase", "products", "sku"),
    ("users_username_nocase", "users", "username"),
)


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
    """Apply schema.sql and the case-insensitive indexes. Safe to call repeatedly."""
    conn.executescript(SCHEMA_PATH.read_text())
    for name, table, column in NOCASE_UNIQUE_INDEXES:
        _create_nocase_unique_index(conn, name, table, column)
    conn.commit()


def _create_nocase_unique_index(
    conn: sqlite3.Connection, name: str, table: str, column: str
) -> None:
    """Create the index, or, if older rows already break the rule, name them and go on.

    A database from before the rule existed can hold "KB-001" next to "kb-001".
    Refusing to start would lock users out of data that worked yesterday, so the
    rule waits until the rows are renamed and is applied on the next start.
    """
    try:
        conn.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {name} ON {table} ({column} COLLATE NOCASE)"
        )
    except sqlite3.IntegrityError:
        groups = conn.execute(
            f"SELECT group_concat({column}, ', ') FROM {table} "
            f"GROUP BY {column} COLLATE NOCASE HAVING count(*) > 1"
        ).fetchall()
        logger.warning(
            "%s.%s has values that differ only by letter case (%s), so new duplicates "
            "like these are not refused yet. Rename them; the rule is applied on the "
            "next start.",
            table,
            column,
            "; ".join(row[0] for row in groups),
        )


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request, always closed."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
