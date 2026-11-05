PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
}


def test_preflight_allows_the_frontend_origin(client):
    response = client.options(
        "/auth/login", headers={"Origin": "http://localhost:3000", **PREFLIGHT_HEADERS}
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_preflight_ignores_unknown_origins(client):
    response = client.options(
        "/auth/login", headers={"Origin": "http://evil.example", **PREFLIGHT_HEADERS}
    )

    assert "access-control-allow-origin" not in response.headers
