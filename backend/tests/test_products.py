import pytest

PAYLOAD = {"sku": "SKU-001", "name": "Widget", "price": 9.99, "quantity": 10}


def test_list_products_requires_auth(client):
    assert client.get("/products").status_code == 401


def test_create_product_requires_auth(client):
    assert client.post("/products", json=PAYLOAD).status_code == 401


def test_list_products_is_empty_initially(client, auth_headers):
    response = client.get("/products", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_create_product_returns_201_with_the_new_product(client, auth_headers):
    response = client.post("/products", json=PAYLOAD, headers=auth_headers)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert {key: body[key] for key in PAYLOAD} == PAYLOAD
    assert body["created_at"]


def test_quantity_defaults_to_zero(client, auth_headers):
    payload = {"sku": "SKU-002", "name": "Gadget", "price": 1.5}

    response = client.post("/products", json=payload, headers=auth_headers)

    assert response.status_code == 201
    assert response.json()["quantity"] == 0


def test_created_product_appears_in_list(client, auth_headers):
    created = client.post("/products", json=PAYLOAD, headers=auth_headers).json()

    response = client.get("/products", headers=auth_headers)

    assert response.json() == [created]


def test_get_product_by_id(client, auth_headers):
    created = client.post("/products", json=PAYLOAD, headers=auth_headers).json()

    response = client.get(f"/products/{created['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_product_returns_404(client, auth_headers):
    response = client.get("/products/999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"


def test_create_product_rejects_duplicate_sku(client, auth_headers):
    client.post("/products", json=PAYLOAD, headers=auth_headers)

    response = client.post("/products", json=PAYLOAD, headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "SKU already exists"


@pytest.mark.parametrize(
    "overrides",
    [
        {"price": -1},
        {"quantity": -5},
        {"sku": ""},
        {"name": ""},
    ],
)
def test_create_product_validates_payload(client, auth_headers, overrides):
    response = client.post("/products", json={**PAYLOAD, **overrides}, headers=auth_headers)

    assert response.status_code == 422
