"""Browser sessions: an httpOnly cookie instead of a token kept in JavaScript."""

from app.security import decode_access_token

FRONTEND = "http://localhost:3000"


def login(client, username: str = "alice", password: str = "secret123"):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_login_sets_an_httponly_session_cookie(client, user):
    response = login(client)

    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("inventra_session=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie
    assert "Max-Age=3600" in cookie
    assert decode_access_token(client.cookies["inventra_session"]) == str(user.id)


def test_the_session_cookie_authenticates_requests(client, user):
    login(client)

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_a_bearer_token_still_works_for_api_clients(client, auth_headers):
    assert client.get("/auth/me", headers=auth_headers).status_code == 200
