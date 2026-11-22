import pytest


@pytest.fixture()
def make_product(client, auth_headers):
    def _make(sku: str, *, price: float = 10.0, quantity: int = 10) -> dict:
        response = client.post(
            "/products",
            json={"sku": sku, "name": f"Product {sku}", "price": price, "quantity": quantity},
            headers=auth_headers,
        )
        assert response.status_code == 201
        return response.json()

    return _make


def stock_of(client, auth_headers, product_id: int) -> int:
    return client.get(f"/products/{product_id}", headers=auth_headers).json()["quantity"]


def place(client, auth_headers, *items: tuple[int, int], customer: str = "ACME Corp"):
    return client.post(
        "/orders",
        json={
            "customer_name": customer,
            "items": [{"product_id": pid, "quantity": qty} for pid, qty in items],
        },
        headers=auth_headers,
    )


def test_create_order_requires_auth(client):
    response = client.post(
        "/orders", json={"customer_name": "ACME", "items": [{"product_id": 1, "quantity": 1}]}
    )

    assert response.status_code == 401


def test_create_order_returns_201_with_items_and_total(client, auth_headers, user, make_product):
    keyboard = make_product("KB-001", price=89.0, quantity=10)
    mouse = make_product("MS-001", price=25.5, quantity=5)

    response = place(client, auth_headers, (keyboard["id"], 2), (mouse["id"], 1))

    assert response.status_code == 201
    order = response.json()
    assert order["id"] > 0
    assert order["customer_name"] == "ACME Corp"
    assert order["status"] == "pending"
    assert order["created_by"] == user.id
    assert order["created_at"]
    assert order["items"] == [
        {
            "product_id": keyboard["id"],
            "sku": "KB-001",
            "name": "Product KB-001",
            "quantity": 2,
            "unit_price": 89.0,
            "line_total": 178.0,
        },
        {
            "product_id": mouse["id"],
            "sku": "MS-001",
            "name": "Product MS-001",
            "quantity": 1,
            "unit_price": 25.5,
            "line_total": 25.5,
        },
    ]
    assert order["total"] == 203.5


def test_create_order_decrements_stock(client, auth_headers, make_product):
    keyboard = make_product("KB-001", quantity=10)
    mouse = make_product("MS-001", quantity=5)

    place(client, auth_headers, (keyboard["id"], 3), (mouse["id"], 5))

    assert stock_of(client, auth_headers, keyboard["id"]) == 7
    assert stock_of(client, auth_headers, mouse["id"]) == 0


def count_rows(db, table: str) -> int:
    return db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def test_insufficient_stock_rejects_the_whole_order(client, auth_headers, db, make_product):
    keyboard = make_product("KB-001", quantity=10)
    mouse = make_product("MS-001", quantity=1)

    response = place(client, auth_headers, (keyboard["id"], 2), (mouse["id"], 2))

    assert response.status_code == 409
    assert response.json()["detail"] == "Insufficient stock for MS-001"
    assert stock_of(client, auth_headers, keyboard["id"]) == 10
    assert stock_of(client, auth_headers, mouse["id"]) == 1
    assert count_rows(db, "orders") == 0
    assert count_rows(db, "order_items") == 0


def test_unknown_product_rejects_the_whole_order(client, auth_headers, db, make_product):
    keyboard = make_product("KB-001", quantity=10)

    response = place(client, auth_headers, (keyboard["id"], 2), (999, 1))

    assert response.status_code == 404
    assert response.json()["detail"] == "Product 999 not found"
    assert stock_of(client, auth_headers, keyboard["id"]) == 10
    assert count_rows(db, "orders") == 0


@pytest.mark.parametrize(
    "payload",
    [
        {"customer_name": "ACME", "items": []},
        {"customer_name": "ACME", "items": [{"product_id": 1, "quantity": 0}]},
        {"customer_name": "ACME", "items": [{"product_id": 1, "quantity": -1}]},
        {"customer_name": "ACME", "items": [{"product_id": 1, "quantity": 1.5}]},
        {"customer_name": "", "items": [{"product_id": 1, "quantity": 1}]},
        {"customer_name": "   ", "items": [{"product_id": 1, "quantity": 1}]},
        {"items": [{"product_id": 1, "quantity": 1}]},
        {"customer_name": "ACME"},
        {
            "customer_name": "ACME",
            "items": [{"product_id": 1, "quantity": 1}, {"product_id": 1, "quantity": 2}],
        },
    ],
)
def test_create_order_validates_payload(client, auth_headers, db, make_product, payload):
    keyboard = make_product("KB-001", quantity=10)
    assert keyboard["id"] == 1

    response = client.post("/orders", json=payload, headers=auth_headers)

    assert response.status_code == 422
    assert stock_of(client, auth_headers, keyboard["id"]) == 10
    assert count_rows(db, "orders") == 0
