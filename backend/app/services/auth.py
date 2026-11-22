import sqlite3

from app.models import User
from app.repositories import users
from app.security import hash_password, verify_password

# Checked when the username is unknown so a failed login costs one bcrypt
# verification either way and its timing does not reveal which usernames exist.
_DUMMY_HASH = hash_password("not-a-real-password")


def authenticate(conn: sqlite3.Connection, username: str, password: str) -> User | None:
    """Return the user when the credentials match, otherwise None."""
    user = users.get_by_username(conn, username)
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
