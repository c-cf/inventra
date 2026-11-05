import sqlite3

import pytest

from app.db import connect, init_db
from app.repositories import users


@pytest.fixture()
def conn(tmp_path):
    connection = connect(tmp_path / "test.db")
    init_db(connection)
    yield connection
    connection.close()


def test_create_then_get_by_username(conn):
    created = users.create(conn, username="alice", password_hash="hash", role="admin")

    found = users.get_by_username(conn, "alice")

    assert found is not None
    assert found.id == created.id
    assert found.username == "alice"
    assert found.role == "admin"
    assert found.password_hash == "hash"


def test_role_defaults_to_staff(conn):
    created = users.create(conn, username="bob", password_hash="hash")

    assert created.role == "staff"


def test_get_by_username_returns_none_when_missing(conn):
    assert users.get_by_username(conn, "nobody") is None


def test_get_by_id(conn):
    created = users.create(conn, username="alice", password_hash="hash")

    assert users.get_by_id(conn, created.id) == created
    assert users.get_by_id(conn, created.id + 1) is None


def test_username_is_unique(conn):
    users.create(conn, username="alice", password_hash="hash")

    with pytest.raises(sqlite3.IntegrityError):
        users.create(conn, username="alice", password_hash="other")


def test_init_db_is_idempotent(conn):
    users.create(conn, username="alice", password_hash="hash")

    init_db(conn)

    assert users.get_by_username(conn, "alice") is not None
