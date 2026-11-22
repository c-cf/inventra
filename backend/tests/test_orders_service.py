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
