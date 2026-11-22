"""User management: admins manage accounts, staff cannot."""

import pytest


def test_list_users_requires_auth(client):
    assert client.get("/users").status_code == 401


def test_staff_cannot_list_users(client, staff_headers):
    response = client.get("/users", headers=staff_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role required"


def test_admin_lists_users_without_password_hashes(client, auth_headers, user, staff):
    response = client.get("/users", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert [(u["username"], u["role"]) for u in body] == [("alice", "admin"), ("bob", "staff")]
    assert all(set(u) == {"id", "username", "role", "created_at"} for u in body)


NEW_USER = {"username": "carol", "password": "carolpass1", "role": "staff"}


def test_staff_cannot_create_users(client, staff_headers):
    assert client.post("/users", json=NEW_USER, headers=staff_headers).status_code == 403


def test_admin_creates_a_user_who_can_then_log_in(client, auth_headers):
    response = client.post("/users", json=NEW_USER, headers=auth_headers)

    assert response.status_code == 201
    body = response.json()
    assert (body["username"], body["role"]) == ("carol", "staff")
    assert "password" not in body and "password_hash" not in body
    login = client.post("/auth/login", json={"username": "carol", "password": "carolpass1"})
    assert login.status_code == 200


def test_creating_a_duplicate_username_returns_409(client, auth_headers, staff):
    response = client.post("/users", json={**NEW_USER, "username": "bob"}, headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Username already exists"


@pytest.mark.parametrize(
    "overrides",
    [
        {"username": "ab"},  # too short
        {"username": "x" * 151},
        {"username": "has space"},
        {"password": "short7!"},  # under 8 characters
        {"password": "é" * 37},  # over bcrypt's 72 bytes
        {"role": "owner"},
        {"role": None},
    ],
)
def test_create_user_validates_payload(client, auth_headers, overrides):
    response = client.post("/users", json={**NEW_USER, **overrides}, headers=auth_headers)

    assert response.status_code == 422
