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


def test_search_treats_like_wildcards_literally(client, auth_headers, catalogue):
    response = client.get("/products", params={"q": "%"}, headers=auth_headers)

    assert skus(response) == []


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
