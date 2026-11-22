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


def _to_item(row: sqlite3.Row) -> OrderItem:
    return OrderItem(
        product_id=row["product_id"],
        sku=row["sku"],
        name=row["name"],
        quantity=row["quantity"],
        unit_price=row["unit_price"],
    )


def _items_by_order(
    conn: sqlite3.Connection, order_ids: list[int]
) -> dict[int, tuple[OrderItem, ...]]:
    """Load the items of several orders in one query."""
    if not order_ids:
        return {}
    placeholders = ", ".join("?" for _ in order_ids)
    rows = conn.execute(
        f"""
        SELECT order_id, product_id, sku, name, quantity, unit_price
        FROM order_items
        WHERE order_id IN ({placeholders})
        ORDER BY id
        """,
        order_ids,
    ).fetchall()
    grouped: dict[int, list[OrderItem]] = {order_id: [] for order_id in order_ids}
    for row in rows:
        grouped[row["order_id"]].append(_to_item(row))
    return {order_id: tuple(items) for order_id, items in grouped.items()}


def _to_orders(conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[Order]:
    items = _items_by_order(conn, [row["id"] for row in rows])
    return [
        Order(
            id=row["id"],
            customer_name=row["customer_name"],
            status=row["status"],
            created_by=row["created_by"],
            created_at=row["created_at"],
            items=items[row["id"]],
        )
        for row in rows
    ]


def get_by_id(conn: sqlite3.Connection, order_id: int) -> Order | None:
    rows = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchall()
    found = _to_orders(conn, rows)
    return found[0] if found else None


def list_all(conn: sqlite3.Connection, *, status: str | None = None) -> list[Order]:
    if status is None:
        rows = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM orders WHERE status = ? ORDER BY id DESC", (status,)
        ).fetchall()
    return _to_orders(conn, rows)


def update_status(conn: sqlite3.Connection, order_id: int, *, current: str, new: str) -> bool:
    """Compare-and-set the status. False when the order is no longer in `current`."""
    cursor = conn.execute(
        "UPDATE orders SET status = ? WHERE id = ? AND status = ?", (new, order_id, current)
    )
    return cursor.rowcount == 1


def get_status(conn: sqlite3.Connection, order_id: int) -> str | None:
    row = conn.execute("SELECT status FROM orders WHERE id = ?", (order_id,)).fetchone()
    return row["status"] if row else None
