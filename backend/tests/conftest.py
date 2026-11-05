import pytest
from fastapi.testclient import TestClient

from app.db import connect, init_db
from app.main import app
from app.repositories import users
from app.security import hash_password


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    """Point the app at a throwaway database for the duration of one test."""
    path = tmp_path / "test.db"
    monkeypatch.setenv("INVENTRA_DB_PATH", str(path))
    return path


@pytest.fixture()
def db(db_path):
    conn = connect(db_path)
    init_db(conn)
    yield conn
    conn.close()


@pytest.fixture()
def client(db) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def user(db):
    return users.create(
        db, username="alice", password_hash=hash_password("secret123"), role="admin"
    )


@pytest.fixture()
def auth_headers(user):
    from app.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
