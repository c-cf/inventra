"""Order rules that span the orders and products tables."""

import sqlite3

from app.models import Order
from app.repositories import orders, products


def place_order(
    conn: sqlite3.Connection,
    *,
    customer_name: str,
    items: list[tuple[int, int]],
    created_by: int,
) -> Order:
    """Create an order and take its items out of stock."""
    order_id = orders.insert(conn, customer_name=customer_name, created_by=created_by)
    for product_id, quantity in items:
        product = products.get_by_id(conn, product_id)
        assert product is not None
        conn.execute(
            "UPDATE products SET quantity = quantity - ? WHERE id = ?", (quantity, product_id)
        )
        orders.insert_item(conn, order_id=order_id, product=product, quantity=quantity)
    conn.commit()
    order = orders.get_by_id(conn, order_id)
    assert order is not None
    return order
