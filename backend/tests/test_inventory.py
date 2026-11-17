
def test_increase_stock(client, auth_headers):
    payload = {
        "sku": "SKU-INV-001",
        "name": "Test Product",
        "price": 100.0,
        "quantity": 10,
    }

    response = client.post(
        "/products",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 201
    product_id = response.json()["id"]

    response = client.post(
        f"/products/{product_id}/adjust",
        json={
            "change": 5,
            "reason": "restock",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 15

    response = client.get(
        f"/products/{product_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 15

def test_decrease_stock(client, auth_headers):
    payload = {
        "sku": "SKU-INV-002",
        "name": "Test Product",
        "price": 100.0,
        "quantity": 10,
    }

    created = client.post(
        "/products", json=payload, headers=auth_headers
    ).json()

    response = client.post(
        f"/products/{created['id']}/adjust",
        json={"change": -3, "reason": "sold"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 7


def test_decrease_stock_to_zero(client, auth_headers):
    payload = {
        "sku": "SKU-INV-003",
        "name": "Test Product",
        "price": 100.0,
        "quantity": 10,
    }

    created = client.post(
        "/products", json=payload, headers=auth_headers
    ).json()

    response = client.post(
        f"/products/{created['id']}/adjust",
        json={"change": -10, "reason": "sold"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 0


def test_insufficient_stock(client, auth_headers):
    payload = {
        "sku": "SKU-INV-004",
        "name": "Test Product",
        "price": 100.0,
        "quantity": 10,
    }

    created = client.post(
        "/products", json=payload, headers=auth_headers
    ).json()

    product_id = created["id"]

    response = client.post(
        f"/products/{product_id}/adjust",
        json={"change": -11, "reason": "sold"},
        headers=auth_headers,
    )

    assert response.status_code == 409

    response = client.get(
        f"/products/{product_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 10


def test_adjust_nonexistent_product(client, auth_headers):
    response = client.post(
        "/products/999/adjust",
        json={"change": 5, "reason": "restock"},
        headers=auth_headers,
    )

    assert response.status_code == 404
