"""Repeated failed logins from one client for one username are throttled."""

import pytest


def login(client, password: str, username: str = "alice"):
    return client.post("/auth/login", json={"username": username, "password": password})


@pytest.fixture()
def throttled(monkeypatch):
    monkeypatch.setenv("INVENTRA_LOGIN_MAX_ATTEMPTS", "3")
    monkeypatch.setenv("INVENTRA_LOGIN_LOCKOUT_SECONDS", "60")


def test_too_many_failures_return_429_even_with_the_right_password(throttled, client, user):
    for _ in range(3):
        assert login(client, "wrong").status_code == 401

    response = login(client, "secret123")

    assert response.status_code == 429
    assert response.json()["detail"] == "Too many failed login attempts. Try again later."
    assert int(response.headers["Retry-After"]) > 0


def test_a_successful_login_resets_the_count(throttled, client, user):
    login(client, "wrong")
    login(client, "wrong")
    assert login(client, "secret123").status_code == 200

    assert login(client, "wrong").status_code == 401
    assert login(client, "wrong").status_code == 401
    assert login(client, "secret123").status_code == 200


def test_other_usernames_are_not_affected(throttled, client, user):
    for _ in range(3):
        login(client, "wrong", username="ghost")

    assert login(client, "secret123").status_code == 200


def test_the_lockout_expires(throttled, client, user, monkeypatch):
    from app import login_throttle

    now = [1000.0]
    monkeypatch.setattr(login_throttle, "_now", lambda: now[0])
    for _ in range(3):
        login(client, "wrong")
    assert login(client, "secret123").status_code == 429

    now[0] += 61

    assert login(client, "secret123").status_code == 200
