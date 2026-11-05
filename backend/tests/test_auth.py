from app.security import decode_access_token


def test_login_returns_bearer_token_for_valid_credentials(client, user):
    response = client.post("/auth/login", json={"username": "alice", "password": "secret123"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert decode_access_token(body["access_token"]) == str(user.id)


def test_login_rejects_wrong_password(client, user):
    response = client.post("/auth/login", json={"username": "alice", "password": "wrong"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_login_rejects_unknown_user(client):
    response = client.post("/auth/login", json={"username": "ghost", "password": "whatever"})

    assert response.status_code == 401


def test_login_validates_payload(client):
    response = client.post("/auth/login", json={"username": "alice"})

    assert response.status_code == 422


def test_me_returns_current_user(client, user, auth_headers):
    response = client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"id": user.id, "username": "alice", "role": "admin"}


def test_me_requires_bearer_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_rejects_malformed_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401


def test_me_rejects_token_for_unknown_user(client):
    from app.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token('999')}"}

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 401
