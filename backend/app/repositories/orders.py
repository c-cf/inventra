"""SQL for orders and their items. Functions here never commit: the order
service owns the transaction so stock changes and order rows land together."""

import sqlite3

from app.models import Order, OrderItem, Product


def insert(conn: sqlite3.Connection, *, customer_name: str, created_by: int) -> int:
    cursor = conn.execute(
        "INSERT INTO orders (customer_name, created_by) VALUES (?, ?)",
        (customer_name, created_by),
    )
    assert cursor.lastrowid is not None
    return cursor.lastrowid


def insert_item(
    conn: sqlite3.Connection, *, order_id: int, product: Product, quantity: int
) -> None:
    conn.execute(
        """
        INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (order_id, product.id, product.sku, product.name, quantity, product.price),
    )


def _items_of(conn: sqlite3.Connection, order_id: int) -> tuple[OrderItem, ...]:
    rows = conn.execute(
        """
        SELECT product_id, sku, name, quantity, unit_price
        FROM order_items
        WHERE order_id = ?
        ORDER BY id
        """,
        (order_id,),
    ).fetchall()
    return tuple(
        OrderItem(
            product_id=row["product_id"],
            sku=row["sku"],
            name=row["name"],
            quantity=row["quantity"],
            unit_price=row["unit_price"],
        )
        for row in rows
    )


def _to_order(conn: sqlite3.Connection, row: sqlite3.Row) -> Order:
    return Order(
        id=row["id"],
        customer_name=row["customer_name"],
        status=row["status"],
        created_by=row["created_by"],
        created_at=row["created_at"],
        items=_items_of(conn, row["id"]),
    )


def get_by_id(conn: sqlite3.Connection, order_id: int) -> Order | None:
    row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    return _to_order(conn, row) if row else None
