"""Service-level tests for rules that cannot be reached through one HTTP request."""

import pytest

from app.repositories import orders, products
from app.services import orders as order_service


@pytest.fixture()
def pending_order(db, user):
    keyboard = products.create(db, sku="KB-001", name="Keyboard", price=89.0, quantity=10)
    order = order_service.place_order(
        db, customer_name="ACME", items=[(keyboard.id, 3)], created_by=user.id
    )
    return order, keyboard


def test_a_stale_read_cannot_cancel_an_order_twice(db, pending_order, monkeypatch):
    order, keyboard = pending_order
    order_service.change_status(db, order.id, "cancelled")
    # Simulate a second request that read the order before the first one committed.
    monkeypatch.setattr(orders, "get_by_id", lambda conn, order_id: order)

    with pytest.raises(order_service.InvalidStatusTransitionError):
        order_service.change_status(db, order.id, "cancelled")

    monkeypatch.undo()
    assert products.get_by_id(db, keyboard.id).quantity == 10
    assert orders.get_by_id(db, order.id).status == "cancelled"


def test_a_failed_order_leaves_nothing_behind_on_a_reused_connection(db, user):
    keyboard = products.create(db, sku="KB-001", name="Keyboard", price=89.0, quantity=10)
    mouse = products.create(db, sku="MS-001", name="Mouse", price=25.0, quantity=1)

    with pytest.raises(order_service.InsufficientStockError):
        order_service.place_order(
            db, customer_name="ACME", items=[(keyboard.id, 2), (mouse.id, 5)], created_by=user.id
        )
    # Committing unrelated work on the same connection must not persist the failed order.
    products.create(db, sku="HB-001", name="Hub", price=39.9, quantity=3)

    assert db.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM order_items").fetchone()[0] == 0
    assert products.get_by_id(db, keyboard.id).quantity == 10


def test_a_failed_status_change_leaves_nothing_behind_on_a_reused_connection(
    db, pending_order, monkeypatch
):
    order, keyboard = pending_order

    def broken_record_movement(*args, **kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(products, "record_movement", broken_record_movement)
    with pytest.raises(RuntimeError):
        order_service.change_status(db, order.id, "cancelled")
    monkeypatch.undo()
    products.create(db, sku="HB-001", name="Hub", price=39.9, quantity=3)

    assert orders.get_by_id(db, order.id).status == "pending"
    assert products.get_by_id(db, keyboard.id).quantity == 7
