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
