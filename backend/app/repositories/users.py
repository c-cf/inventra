import sqlite3

from app.models import User


class DuplicateUsernameError(Exception):
    """Raised when creating a user whose username is taken."""


def _to_user(row: sqlite3.Row) -> User:
    return User(
        id=row["id"],
        username=row["username"],
        password_hash=row["password_hash"],
        role=row["role"],
        created_at=row["created_at"],
    )


def create(
    conn: sqlite3.Connection, *, username: str, password_hash: str, role: str = "staff"
) -> User:
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role),
        )
    except sqlite3.IntegrityError as exc:
        if "UNIQUE constraint failed: users.username" in str(exc):
            raise DuplicateUsernameError(username) from exc
        raise
    conn.commit()
    user = get_by_id(conn, cursor.lastrowid)
    assert user is not None
    return user


def get_by_id(conn: sqlite3.Connection, user_id: int) -> User | None:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _to_user(row) if row else None


def get_by_username(conn: sqlite3.Connection, username: str) -> User | None:
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return _to_user(row) if row else None


def list_all(conn: sqlite3.Connection) -> list[User]:
    rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    return [_to_user(row) for row in rows]
