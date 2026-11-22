"""Order rules that span the orders and products tables."""

import sqlite3

from app.models import Order
from app.repositories import orders, products


class InsufficientStockError(Exception):
    """Raised when an order asks for more of a product than is in stock."""

    def __init__(self, sku: str) -> None:
        super().__init__(sku)
        self.sku = sku


def place_order(
    conn: sqlite3.Connection,
    *,
    customer_name: str,
    items: list[tuple[int, int]],
    created_by: int,
) -> Order:
    """Create an order and take its items out of stock, all or nothing."""
    try:
        order_id = orders.insert(conn, customer_name=customer_name, created_by=created_by)
        for product_id, quantity in items:
            product = products.get_by_id(conn, product_id)
            assert product is not None
            if not products.remove_stock(conn, product_id, quantity):
                raise InsufficientStockError(product.sku)
            orders.insert_item(conn, order_id=order_id, product=product, quantity=quantity)
    except Exception:
        conn.rollback()
        raise
    conn.commit()
    order = orders.get_by_id(conn, order_id)
    assert order is not None
    return order
