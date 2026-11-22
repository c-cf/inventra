import sqlite3

from app.models import Product


class DuplicateSkuError(Exception):
    """Raised when inserting a product whose SKU already exists."""


class InsufficientStockError(Exception):
    """Raised when stock would become negative."""


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
        if "products.sku" in str(exc):
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
    rows = conn.execute("SELECT * FROM products ORDER BY id").fetchall()
    return [_to_product(row) for row in rows]


def update(conn: sqlite3.Connection, product_id: int, **fields) -> Product | None:
    if fields:
        assignments = ", ".join(f"{column} = ?" for column in fields)
        try:
            conn.execute(
                f"UPDATE products SET {assignments} WHERE id = ?",
                (*fields.values(), product_id),
            )
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed: products.sku" in str(exc):
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

    conn.execute(
        """
        INSERT INTO stock_movements (product_id, change, reason)
        VALUES (?, ?, ?)
        """,
        (product_id, change, reason),
    )

    conn.commit()
    return get_by_id(conn, product_id)


def get_stock_movements(
    conn: sqlite3.Connection,
    product_id: int,
):
    return conn.execute(
        """
        SELECT id, product_id, change, reason, created_at
        FROM stock_movements
        WHERE product_id = ?
        ORDER BY id ASC
        """,
        (product_id,),
    ).fetchall()


def get_low_stock_products(
    conn: sqlite3.Connection,
    below: int,
) -> list[Product]:
    rows = conn.execute(
        """
        SELECT *
        FROM products
        WHERE quantity < ?
        ORDER BY id ASC
        """,
        (below,),
    ).fetchall()

    return [_to_product(row) for row in rows]
