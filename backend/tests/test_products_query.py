"""Search, pagination and deletion on /products."""

import pytest

CATALOGUE = [
    {"sku": "KB-001", "name": "Mechanical Keyboard", "price": 89.0, "quantity": 25},
    {"sku": "MS-001", "name": "Wireless Mouse", "price": 29.5, "quantity": 2},
    {"sku": "KB-002", "name": "Compact Keyboard", "price": 49.0, "quantity": 1},
    {"sku": "HB-001", "name": "USB-C Hub", "price": 39.9, "quantity": 0},
]


@pytest.fixture()
def catalogue(client, auth_headers) -> list[dict]:
    created = []
    for product in CATALOGUE:
        response = client.post("/products", json=product, headers=auth_headers)
        assert response.status_code == 201
        created.append(response.json())
    return created


def skus(response) -> list[str]:
    return [product["sku"] for product in response.json()]


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("keyboard", ["KB-001", "KB-002"]),  # name, case-insensitive
        ("ms-0", ["MS-001"]),  # SKU, case-insensitive
        ("usb", ["HB-001"]),
        ("nothing-matches", []),
    ],
)
def test_search_products_by_name_or_sku(client, auth_headers, catalogue, query, expected):
    response = client.get("/products", params={"q": query}, headers=auth_headers)

    assert response.status_code == 200
    assert skus(response) == expected


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("%", ["PCT-1"]),
        ("50%", ["PCT-1"]),
        ("_", ["USC-1"]),
        ("r_s", ["USC-1"]),
        ("!", ["BNG-1"]),
        ("wow!", ["BNG-1"]),
        ("!!", []),
    ],
)
def test_search_treats_like_wildcards_literally(client, auth_headers, catalogue, query, expected):
    for sku, name in [
        ("PCT-1", "Wow 50% off"),
        ("USC-1", "under_score"),
        ("BNG-1", "Wow! Deal"),
        ("PLN-1", "Plain 5000 rs"),
    ]:
        client.post(
            "/products",
            json={"sku": sku, "name": name, "price": 1, "quantity": 1},
            headers=auth_headers,
        )

    response = client.get("/products", params={"q": query}, headers=auth_headers)

    assert skus(response) == expected


def test_search_combines_with_the_low_stock_filter(client, auth_headers, catalogue):
    response = client.get("/products", params={"q": "keyboard", "below": 5}, headers=auth_headers)

    assert skus(response) == ["KB-002"]


def test_paginate_products_with_limit_and_offset(client, auth_headers, catalogue):
    first = client.get("/products", params={"limit": 2}, headers=auth_headers)
    second = client.get("/products", params={"limit": 2, "offset": 2}, headers=auth_headers)

    assert skus(first) == ["KB-001", "MS-001"]
    assert skus(second) == ["KB-002", "HB-001"]
    assert first.headers["X-Total-Count"] == "4"


def test_total_count_reflects_the_filters(client, auth_headers, catalogue):
    response = client.get("/products", params={"q": "keyboard", "limit": 1}, headers=auth_headers)

    assert skus(response) == ["KB-001"]
    assert response.headers["X-Total-Count"] == "2"


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
def test_pagination_validates_its_parameters(client, auth_headers, params):
    assert client.get("/products", params=params, headers=auth_headers).status_code == 422


def test_browsers_may_read_the_total_count_header(client):
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})

    assert "x-total-count" in response.headers["access-control-expose-headers"].lower()


def test_delete_product_requires_auth(client, catalogue):
    assert client.delete(f"/products/{catalogue[0]['id']}").status_code == 401


def test_delete_product_removes_it_and_its_stock_history(client, auth_headers, db, catalogue):
    keyboard = catalogue[0]
    client.post(
        f"/products/{keyboard['id']}/adjust",
        json={"change": 5, "reason": "restock"},
        headers=auth_headers,
    )

    response = client.delete(f"/products/{keyboard['id']}", headers=auth_headers)

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/products/{keyboard['id']}", headers=auth_headers).status_code == 404
    remaining = db.execute(
        "SELECT COUNT(*) FROM stock_movements WHERE product_id = ?", (keyboard["id"],)
    ).fetchone()[0]
    assert remaining == 0


def test_delete_missing_product_returns_404(client, auth_headers):
    response = client.delete("/products/999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"


def test_a_product_that_was_ordered_cannot_be_deleted(client, auth_headers, catalogue):
    keyboard = catalogue[0]
    order = client.post(
        "/orders",
        json={"customer_name": "ACME", "items": [{"product_id": keyboard["id"], "quantity": 1}]},
        headers=auth_headers,
    )
    assert order.status_code == 201

    response = client.delete(f"/products/{keyboard['id']}", headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Product has orders and cannot be deleted"
    assert client.get(f"/products/{keyboard['id']}", headers=auth_headers).status_code == 200


HUGE = 10**20  # larger than SQLite's 64-bit INTEGER


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", f"/products/{HUGE}", None),
        ("patch", f"/products/{HUGE}", {"name": "x"}),
        ("delete", f"/products/{HUGE}", None),
        ("post", f"/products/{HUGE}/adjust", {"change": 1, "reason": "x"}),
        ("get", f"/products/{HUGE}/movements", None),
        ("get", "/products", {"below": HUGE}),
        ("get", "/products", {"offset": HUGE}),
    ],
)
def test_product_endpoints_reject_out_of_range_integers(client, auth_headers, method, path, body):
    if method == "get":
        response = client.get(path, params=body, headers=auth_headers)
    else:
        response = client.request(method, path, json=body, headers=auth_headers)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"sku": "BIG-1", "name": "Big", "price": 1, "quantity": HUGE},
        {"sku": "BIG-2", "name": "Big", "price": 2_000_000_000},
    ],
)
def test_create_product_rejects_out_of_range_numbers(client, auth_headers, payload):
    assert client.post("/products", json=payload, headers=auth_headers).status_code == 422


def test_create_product_rejects_an_infinite_price(client, auth_headers):
    # httpx refuses to serialize inf, so send the overflowing literal as raw JSON.
    response = client.post(
        "/products",
        content=b'{"sku": "INF-1", "name": "Inf", "price": 1e309}',
        headers={**auth_headers, "Content-Type": "application/json"},
    )

    assert response.status_code == 422


def test_adjust_rejects_an_out_of_range_change(client, auth_headers, catalogue):
    response = client.post(
        f"/products/{catalogue[0]['id']}/adjust",
        json={"change": HUGE, "reason": "x"},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_search_matches_non_ascii_names_typed_exactly(client, auth_headers):
    client.post(
        "/products",
        json={"sku": "EC-1", "name": "Écran Ärger", "price": 1, "quantity": 1},
        headers=auth_headers,
    )

    response = client.get("/products", params={"q": "Écran"}, headers=auth_headers)

    assert skus(response) == ["EC-1"]
