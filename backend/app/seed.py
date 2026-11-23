"""Development seed: an admin account plus a few products to look at.

Run from the backend directory:

    uv run python -m app.seed
"""

import sqlite3
from dataclasses import dataclass

from app.db import connect, init_db
from app.models import User
from app.repositories import products, users
from app.repositories.products import DuplicateSkuError
from app.repositories.users import DuplicateUsernameError
from app.security import hash_password

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"  # development only; change before any real deployment
STAFF_USERNAME = "staff"
STAFF_PASSWORD = "staff123"  # development only

ACCOUNTS: tuple[tuple[str, str, str], ...] = (
    (ADMIN_USERNAME, ADMIN_PASSWORD, "admin"),
    (STAFF_USERNAME, STAFF_PASSWORD, "staff"),
)

SAMPLE_PRODUCTS: list[dict] = [
    {"sku": "KB-001", "name": "Mechanical Keyboard", "price": 89.0, "quantity": 25},
    {"sku": "MS-001", "name": "Wireless Mouse", "price": 29.5, "quantity": 40},
    {"sku": "MN-027", "name": '27" Monitor', "price": 249.0, "quantity": 8},
    {"sku": "HS-001", "name": "USB-C Hub", "price": 39.9, "quantity": 0},
]


@dataclass(frozen=True)
class SeedReport:
    """What seed() did, so the script can say so instead of assuming it all went in."""

    created: tuple[tuple[str, str], ...]  # (username, role)
    kept: tuple[tuple[str, str], ...]  # (username, the role it has now)
    skipped: tuple[tuple[str, str], ...]  # (username wanted, existing name in another case)
    products_added: int


def seed(conn: sqlite3.Connection) -> SeedReport:
    init_db(conn)
    created: list[tuple[str, str]] = []
    kept: list[tuple[str, str]] = []
    skipped: list[tuple[str, str]] = []
    for username, password, role in ACCOUNTS:
        found = _find_account(conn, username)
        if found is None:
            try:
                users.create(
                    conn, username=username, password_hash=hash_password(password), role=role
                )
            except DuplicateUsernameError:
                found = _find_account(conn, username)  # another writer took it meanwhile
            else:
                created.append((username, role))
                continue
        if found is not None and found.username == username:
            kept.append((username, found.role))
        else:
            skipped.append((username, found.username if found else username))
    products_added = sum(_add_product(conn, product) for product in SAMPLE_PRODUCTS)
    return SeedReport(tuple(created), tuple(kept), tuple(skipped), products_added)


def _find_account(conn: sqlite3.Connection, username: str) -> User | None:
    """The account with this exact name, else one whose name differs only in case."""
    return users.get_by_username(conn, username) or users.get_by_username_ignoring_case(
        conn, username
    )


def _add_product(conn: sqlite3.Connection, product: dict) -> bool:
    """Add a sample product; False when its SKU is already there."""
    try:
        products.create(conn, **product)
    except DuplicateSkuError:
        return False
    return True


def describe(report: SeedReport) -> list[str]:
    lines = [f"Created user '{name}' ({role})." for name, role in report.created]
    lines += [
        f"Kept user '{name}' ({role}): it already exists; its password was not changed."
        for name, role in report.kept
    ]
    lines += [
        f"Skipped user '{wanted}': '{existing}' already exists and usernames ignore letter case."
        for wanted, existing in report.skipped
    ]
    lines.append(f"Added {report.products_added} of {len(SAMPLE_PRODUCTS)} sample products.")
    return lines


def main() -> None:
    conn = connect()
    try:
        report = seed(conn)
    finally:
        conn.close()
    print("\n".join(describe(report)))


if __name__ == "__main__":
    main()
