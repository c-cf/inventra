"""Timestamps leave the API as ISO 8601 in UTC with an explicit "Z" (#26).

SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC with no zone, which
clients can't tell apart from local time.
"""

import re

ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def test_product_timestamps_are_iso_utc(client, auth_headers):
    created = client.post(
        "/products",
        json={"sku": "TS-1", "name": "Clock", "price": 1, "quantity": 5},
        headers=auth_headers,
    ).json()

    assert ISO_UTC.match(created["created_at"])
    listed = client.get("/products", headers=auth_headers).json()[0]
    assert ISO_UTC.match(listed["created_at"])


def test_order_and_movement_timestamps_are_iso_utc(client, auth_headers):
    product = client.post(
        "/products",
        json={"sku": "TS-2", "name": "Clock", "price": 1, "quantity": 5},
        headers=auth_headers,
    ).json()
    order = client.post(
        "/orders",
        json={"customer_name": "ACME", "items": [{"product_id": product["id"], "quantity": 1}]},
        headers=auth_headers,
    ).json()

    assert ISO_UTC.match(order["created_at"])
    movement = client.get(f"/products/{product['id']}/movements", headers=auth_headers).json()[0]
    assert ISO_UTC.match(movement["created_at"])


def test_user_timestamps_are_iso_utc(client, auth_headers, user):
    listed = client.get("/users", headers=auth_headers).json()[0]

    assert ISO_UTC.match(listed["created_at"])
