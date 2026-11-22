"""Development seed: an admin account plus a few products to look at.

Run from the backend directory:

    uv run python -m app.seed
"""

import sqlite3

from app.db import connect, init_db
from app.repositories import products, users
from app.repositories.products import DuplicateSkuError
from app.security import hash_password

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"  # development only; change before any real deployment
STAFF_USERNAME = "staff"
STAFF_PASSWORD = "staff123"  # development only

SAMPLE_PRODUCTS: list[dict] = [
    {"sku": "KB-001", "name": "Mechanical Keyboard", "price": 89.0, "quantity": 25},
    {"sku": "MS-001", "name": "Wireless Mouse", "price": 29.5, "quantity": 40},
    {"sku": "MN-027", "name": '27" Monitor', "price": 249.0, "quantity": 8},
    {"sku": "HS-001", "name": "USB-C Hub", "price": 39.9, "quantity": 0},
]


def seed(conn: sqlite3.Connection) -> None:
    init_db(conn)
    for username, password, role in (
        (ADMIN_USERNAME, ADMIN_PASSWORD, "admin"),
        (STAFF_USERNAME, STAFF_PASSWORD, "staff"),
    ):
        if users.get_by_username(conn, username) is None:
            users.create(conn, username=username, password_hash=hash_password(password), role=role)
    for product in SAMPLE_PRODUCTS:
        try:
            products.create(conn, **product)
        except DuplicateSkuError:
            continue


def main() -> None:
    conn = connect()
    try:
        seed(conn)
    finally:
        conn.close()
    print(
        f"Seeded users '{ADMIN_USERNAME}' (admin) and '{STAFF_USERNAME}' (staff) "
        f"and {len(SAMPLE_PRODUCTS)} products."
    )


if __name__ == "__main__":
    main()
