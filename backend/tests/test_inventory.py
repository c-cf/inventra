import pytest


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

    created = client.post("/products", json=payload, headers=auth_headers).json()

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

    created = client.post("/products", json=payload, headers=auth_headers).json()

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

    created = client.post("/products", json=payload, headers=auth_headers).json()

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


@pytest.mark.parametrize(
    "adjustment",
    [
        {"change": 0, "reason": "restock"},
        {"change": "abc", "reason": "restock"},
        {"reason": "restock"},
        {"change": 5},
        {"change": 5, "reason": ""},
    ],
)
def test_invalid_stock_adjustment(client, auth_headers, adjustment):
    payload = {
        "sku": "SKU-INV-INVALID",
        "name": "Test Product",
        "price": 100.0,
        "quantity": 10,
    }

    created = client.post(
        "/products",
        json=payload,
        headers=auth_headers,
    ).json()

    product_id = created["id"]

    response = client.post(
        f"/products/{product_id}/adjust",
        json=adjustment,
        headers=auth_headers,
    )

    assert response.status_code == 422

    response = client.get(
        f"/products/{product_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 10


def test_stock_adjustment_creates_movement(client, auth_headers):
    payload = {
        "sku": "SKU-INV-MOVE-001",
        "name": "Movement Test",
        "price": 100.0,
        "quantity": 10,
    }

    created = client.post(
        "/products",
        json=payload,
        headers=auth_headers,
    )
    assert created.status_code == 201
    product_id = created.json()["id"]

    response = client.post(
        f"/products/{product_id}/adjust",
        json={"change": 5, "reason": "restock"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 15

    history = client.get(
        f"/products/{product_id}/movements",
        headers=auth_headers,
    )

    assert history.status_code == 200

    movements = history.json()
    assert len(movements) == 1
    assert movements[0]["product_id"] == product_id
    assert movements[0]["change"] == 5
    assert movements[0]["reason"] == "restock"
    assert "created_at" in movements[0]


def test_failed_adjustment_does_not_create_movement(client, auth_headers):
    payload = {
        "sku": "SKU-INV-MOVE-002",
        "name": "Failed Movement Test",
        "price": 100.0,
        "quantity": 10,
    }

    created = client.post(
        "/products",
        json=payload,
        headers=auth_headers,
    )
    assert created.status_code == 201
    product_id = created.json()["id"]

    response = client.post(
        f"/products/{product_id}/adjust",
        json={"change": -20, "reason": "sold"},
        headers=auth_headers,
    )

    assert response.status_code == 409

    product = client.get(
        f"/products/{product_id}",
        headers=auth_headers,
    )
    assert product.status_code == 200
    assert product.json()["quantity"] == 10

    history = client.get(
        f"/products/{product_id}/movements",
        headers=auth_headers,
    )

    assert history.status_code == 200
    assert history.json() == []


def test_get_low_stock_products(client, auth_headers):
    products = [
        {"sku": "LOW-001", "name": "Product A", "price": 100, "quantity": 2},
        {"sku": "LOW-002", "name": "Product B", "price": 100, "quantity": 4},
        {"sku": "LOW-003", "name": "Product C", "price": 100, "quantity": 5},
        {"sku": "LOW-004", "name": "Product D", "price": 100, "quantity": 10},
    ]

    for product in products:
        response = client.post(
            "/products",
            json=product,
            headers=auth_headers,
        )
        assert response.status_code == 201

    response = client.get(
        "/products?below=5",
        headers=auth_headers,
    )

    assert response.status_code == 200

    result = response.json()
    assert len(result) == 2
    assert {item["sku"] for item in result} == {
        "LOW-001",
        "LOW-002",
    }
