"""Timestamps leave the API as ISO 8601 in UTC with an explicit "Z" (#26).

SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC with no zone, which
clients can't tell apart from local time.
"""

import re
from datetime import UTC, datetime, timedelta

from app.schemas.timestamps import to_iso_utc

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


def test_a_stored_timestamp_keeps_its_time_and_gains_a_z():
    assert to_iso_utc("2026-11-22 18:46:25") == "2026-11-22T18:46:25Z"


def test_converting_an_already_converted_timestamp_changes_nothing():
    assert to_iso_utc("2026-11-22T18:46:25Z") == "2026-11-22T18:46:25Z"


def test_a_new_products_timestamp_is_the_current_utc_time(client, auth_headers):
    created = client.post(
        "/products",
        json={"sku": "TS-NOW", "name": "Clock", "price": 1, "quantity": 5},
        headers=auth_headers,
    ).json()

    stamped = datetime.fromisoformat(created["created_at"])
    assert abs(datetime.now(UTC) - stamped) < timedelta(minutes=1)
