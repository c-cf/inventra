import sqlite3

from app.models import Product, StockMovement


class DuplicateSkuError(Exception):
    """Raised when inserting a product whose SKU already exists."""


class InsufficientStockError(Exception):
    """Raised when stock would become negative."""


class ProductInUseError(Exception):
    """Raised when deleting a product that order items still reference."""


def _is_duplicate_sku(exc: sqlite3.IntegrityError) -> bool:
    # Match the UNIQUE violation only: a NOT NULL failure also mentions products.sku.
    return "UNIQUE constraint failed: products.sku" in str(exc)


def _to_product(row: sqlite3.Row) -> Product:
    return Product(
        id=row["id"],
        sku=row["sku"],
        name=row["name"],
        price=row["price"],
        quantity=row["quantity"],
        created_at=row["created_at"],
    )


def create(
    conn: sqlite3.Connection, *, sku: str, name: str, price: float, quantity: int = 0
) -> Product:
    try:
        cursor = conn.execute(
            "INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)",
            (sku, name, price, quantity),
        )
    except sqlite3.IntegrityError as exc:
        if _is_duplicate_sku(exc):
            raise DuplicateSkuError(sku) from exc
        raise
    conn.commit()
    product = get_by_id(conn, cursor.lastrowid)
    assert product is not None
    return product


def get_by_id(conn: sqlite3.Connection, product_id: int) -> Product | None:
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return _to_product(row) if row else None


def list_all(conn: sqlite3.Connection) -> list[Product]:
    return find(conn)


def update(conn: sqlite3.Connection, product_id: int, **fields) -> Product | None:
    if fields:
        assignments = ", ".join(f"{column} = ?" for column in fields)
        try:
            conn.execute(
                f"UPDATE products SET {assignments} WHERE id = ?",
                (*fields.values(), product_id),
            )
        except sqlite3.IntegrityError as exc:
            if _is_duplicate_sku(exc):
                raise DuplicateSkuError(fields["sku"]) from exc
            raise
        conn.commit()
    return get_by_id(conn, product_id)


def adjust_stock(
    conn: sqlite3.Connection,
    product_id: int,
    change: int,
    reason: str,
) -> Product | None:
    cursor = conn.execute(
        """
        UPDATE products
        SET quantity = quantity + ?
        WHERE id = ?
          AND quantity + ? >= 0
        """,
        (change, product_id, change),
    )

    if cursor.rowcount == 0:
        if get_by_id(conn, product_id) is None:
            return None
        raise InsufficientStockError()

    record_movement(conn, product_id, change, reason)
    conn.commit()
    return get_by_id(conn, product_id)


def _to_movement(row: sqlite3.Row) -> StockMovement:
    return StockMovement(
        id=row["id"],
        product_id=row["product_id"],
        change=row["change"],
        reason=row["reason"],
        created_at=row["created_at"],
    )


def get_stock_movements(conn: sqlite3.Connection, product_id: int) -> list[StockMovement]:
    rows = conn.execute(
        """
        SELECT id, product_id, change, reason, created_at
        FROM stock_movements
        WHERE product_id = ?
        ORDER BY id ASC
        """,
        (product_id,),
    ).fetchall()
    return [_to_movement(row) for row in rows]


_LIKE_ESCAPE = "!"


def _like_pattern(text: str) -> str:
    """Substring pattern in which %, _ and ! match themselves.

    SQLite's LIKE already ignores case for ASCII letters. Lower-casing here (or
    with SQLite's ASCII-only lower()) would stop non-ASCII names such as "Écran"
    matching even when typed exactly.
    """
    escaped = (
        text.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", f"{_LIKE_ESCAPE}%")
        .replace("_", f"{_LIKE_ESCAPE}_")
    )
    return f"%{escaped}%"


def _filters(q: str | None, below: int | None) -> tuple[str, list[object]]:
    clauses: list[str] = []
    params: list[object] = []
    if q:
        clauses.append("(name LIKE ? ESCAPE '!' OR sku LIKE ? ESCAPE '!')")
        params += [_like_pattern(q), _like_pattern(q)]
    if below is not None:
        clauses.append("quantity < ?")
        params.append(below)
    return (f"WHERE {' AND '.join(clauses)}" if clauses else ""), params


def find(
    conn: sqlite3.Connection,
    *,
    q: str | None = None,
    below: int | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> list[Product]:
    """Products matching an optional name/SKU search and low-stock threshold."""
    where, params = _filters(q, below)
    sql = f"SELECT * FROM products {where} ORDER BY id"
    if limit is not None or offset:
        sql += " LIMIT ? OFFSET ?"
        params += [-1 if limit is None else limit, offset]  # SQLite: LIMIT -1 = no limit
    rows = conn.execute(sql, params).fetchall()
    return [_to_product(row) for row in rows]


def count(conn: sqlite3.Connection, *, q: str | None = None, below: int | None = None) -> int:
    where, params = _filters(q, below)
    return conn.execute(f"SELECT COUNT(*) FROM products {where}", params).fetchone()[0]


def remove_stock(conn: sqlite3.Connection, product_id: int, quantity: int) -> bool:
    """Take quantity out of stock if enough is left. Does not commit."""
    cursor = conn.execute(
        "UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?",
        (quantity, product_id, quantity),
    )
    return cursor.rowcount == 1


def record_movement(conn: sqlite3.Connection, product_id: int, change: int, reason: str) -> None:
    """Append a row to the stock audit trail. Does not commit."""
    conn.execute(
        "INSERT INTO stock_movements (product_id, change, reason) VALUES (?, ?, ?)",
        (product_id, change, reason),
    )


def add_stock(conn: sqlite3.Connection, product_id: int, quantity: int) -> None:
    """Put quantity back into stock. Does not commit."""
    conn.execute("UPDATE products SET quantity = quantity + ? WHERE id = ?", (quantity, product_id))


def delete(conn: sqlite3.Connection, product_id: int) -> bool:
    """Delete a product and its stock history. False when it does not exist.

    Order items reference products, so the foreign key refuses to delete an
    ordered product even if an order lands between a check and the delete.
    """
    try:
        conn.execute("DELETE FROM stock_movements WHERE product_id = ?", (product_id,))
        cursor = conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        if "FOREIGN KEY constraint failed" in str(exc):
            raise ProductInUseError(product_id) from exc
        raise
    conn.commit()
    return cursor.rowcount == 1
