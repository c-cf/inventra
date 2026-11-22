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


def test_logout_clears_the_session_cookie(client, user):
    login(client)

    response = client.post("/auth/logout")

    assert response.status_code == 204
    assert 'inventra_session=""' in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert client.get("/auth/me").status_code == 401


def test_cors_lets_the_frontend_send_cookies(client):
    response = client.options(
        "/products",
        headers={"Origin": FRONTEND, "Access-Control-Request-Method": "POST"},
    )

    assert response.headers["access-control-allow-credentials"] == "true"
    assert response.headers["access-control-allow-origin"] == FRONTEND


PRODUCT = {"sku": "CK-1", "name": "Cookie", "price": 1, "quantity": 1}


def test_cookie_writes_from_another_site_are_refused(client, user):
    login(client)

    response = client.post("/products", json=PRODUCT, headers={"Origin": "http://evil.example"})

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-site request refused"


def test_cookie_writes_without_an_origin_are_refused(client, user):
    login(client)

    assert client.post("/products", json=PRODUCT).status_code == 403


def test_cookie_writes_from_the_frontend_are_allowed(client, user):
    login(client)

    response = client.post("/products", json=PRODUCT, headers={"Origin": FRONTEND})

    assert response.status_code == 201


def test_cookie_reads_need_no_origin(client, user):
    login(client)

    assert client.get("/products").status_code == 200


def test_bearer_writes_need_no_origin(client, auth_headers):
    assert client.post("/products", json=PRODUCT, headers=auth_headers).status_code == 201


def test_the_cookie_can_be_marked_secure(client, user, monkeypatch):
    monkeypatch.setenv("INVENTRA_COOKIE_SECURE", "true")

    response = login(client)

    assert "Secure" in response.headers["set-cookie"]


def test_logout_from_another_site_is_refused(client, user):
    login(client)

    response = client.post("/auth/logout", headers={"Origin": "http://evil.example"})

    assert response.status_code == 403
    assert client.get("/auth/me").status_code == 200
