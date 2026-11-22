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


def test_placing_an_order_records_stock_movements(client, auth_headers, make_product):
    keyboard = make_product("KB-001", quantity=10)

    order = place(client, auth_headers, (keyboard["id"], 3)).json()

    movements = client.get(f"/products/{keyboard['id']}/movements", headers=auth_headers).json()
    assert [(m["change"], m["reason"]) for m in movements] == [(-3, f"order #{order['id']}")]


def test_list_orders_requires_auth(client):
    assert client.get("/orders").status_code == 401


def test_list_orders_returns_newest_first(client, auth_headers, make_product):
    keyboard = make_product("KB-001", quantity=10)
    first = place(client, auth_headers, (keyboard["id"], 1), customer="First").json()
    second = place(client, auth_headers, (keyboard["id"], 2), customer="Second").json()

    response = client.get("/orders", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == [second, first]


def test_get_order_by_id(client, auth_headers, make_product):
    keyboard = make_product("KB-001", quantity=10)
    created = place(client, auth_headers, (keyboard["id"], 1)).json()

    response = client.get(f"/orders/{created['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_order_returns_404(client, auth_headers):
    response = client.get("/orders/999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Order not found"


def set_status(client, auth_headers, order_id: int, new_status: str):
    return client.patch(f"/orders/{order_id}", json={"status": new_status}, headers=auth_headers)


def test_update_order_status_requires_auth(client):
    assert client.patch("/orders/1", json={"status": "paid"}).status_code == 401


def test_order_moves_from_pending_to_paid_to_shipped(client, auth_headers, make_product):
    keyboard = make_product("KB-001", quantity=10)
    order = place(client, auth_headers, (keyboard["id"], 1)).json()

    paid = set_status(client, auth_headers, order["id"], "paid")
    shipped = set_status(client, auth_headers, order["id"], "shipped")

    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"
    assert shipped.status_code == 200
    assert shipped.json()["status"] == "shipped"
    assert client.get(f"/orders/{order['id']}", headers=auth_headers).json()["status"] == "shipped"
    assert stock_of(client, auth_headers, keyboard["id"]) == 9


def test_update_status_of_missing_order_returns_404(client, auth_headers):
    response = set_status(client, auth_headers, 999, "paid")

    assert response.status_code == 404
    assert response.json()["detail"] == "Order not found"


@pytest.mark.parametrize(
    ("path", "target"),
    [
        ([], "shipped"),  # pending cannot skip payment
        ([], "pending"),  # already pending
        (["paid"], "pending"),
        (["paid"], "paid"),
        (["paid", "shipped"], "paid"),
        (["paid", "shipped"], "cancelled"),  # shipped goods cannot be cancelled
        (["cancelled"], "paid"),
        (["cancelled"], "cancelled"),
    ],
)
def test_invalid_status_transition_returns_409(client, auth_headers, make_product, path, target):
    keyboard = make_product("KB-001", quantity=10)
    order = place(client, auth_headers, (keyboard["id"], 1)).json()
    for step in path:
        assert set_status(client, auth_headers, order["id"], step).status_code == 200
    current = path[-1] if path else "pending"

    response = set_status(client, auth_headers, order["id"], target)

    assert response.status_code == 409
    assert response.json()["detail"] == f"Cannot change an order from {current} to {target}"
    assert client.get(f"/orders/{order['id']}", headers=auth_headers).json()["status"] == current


@pytest.mark.parametrize("payload", [{"status": "refunded"}, {"status": ""}, {}])
def test_update_status_validates_payload(client, auth_headers, make_product, payload):
    keyboard = make_product("KB-001", quantity=10)
    order = place(client, auth_headers, (keyboard["id"], 1)).json()

    response = client.patch(f"/orders/{order['id']}", json=payload, headers=auth_headers)

    assert response.status_code == 422
