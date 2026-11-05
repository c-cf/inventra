import sqlite3

from app.models import User
from app.repositories import users
from app.security import verify_password


def authenticate(conn: sqlite3.Connection, username: str, password: str) -> User | None:
    """Return the user when the credentials match, otherwise None."""
    user = users.get_by_username(conn, username)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user
