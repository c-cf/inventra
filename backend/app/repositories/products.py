import sqlite3

from app.models import Product


class DuplicateSkuError(Exception):
    """Raised when inserting a product whose SKU already exists."""


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
