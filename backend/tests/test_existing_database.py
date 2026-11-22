"""Starting on a database created before SKUs and usernames became case-insensitive (#27).

Such a database can already hold "KB-001" next to "kb-001". The app must still start,
say what blocks the new rule, and apply it once the data is fixed.
"""

import logging
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app
from app.repositories import products, users
from app.repositories.products import DuplicateSkuError

NOCASE_INDEXES = ("products_sku_nocase", "users_username_nocase")


def _as_before_27(conn: sqlite3.Connection) -> None:
    """Drop the case-insensitive indexes, as on a database from before #27."""
    for name in NOCASE_INDEXES:
        conn.execute(f"DROP INDEX IF EXISTS {name}")
    conn.commit()


def _add_product(conn: sqlite3.Connection, sku: str) -> None:
    products.create(conn, sku=sku, name=f"Product {sku}", price=1.0, quantity=1)


def _add_user(conn: sqlite3.Connection, username: str) -> None:
    users.create(conn, username=username, password_hash="x", role="staff")


def _has_index(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?", (name,)
    ).fetchone()
    return row is not None


def test_init_db_starts_on_a_database_with_skus_differing_only_by_case(db, caplog):
    _as_before_27(db)
    _add_product(db, "KB-001")
    _add_product(db, "kb-001")
    _add_product(db, "MS-001")

    with caplog.at_level(logging.WARNING, logger="app.db"):
        init_db(db)

    assert "products.sku" in caplog.text
    assert "KB-001" in caplog.text and "kb-001" in caplog.text
    assert "MS-001" not in caplog.text  # only the duplicates are listed


def test_init_db_still_applies_the_rule_to_a_table_without_duplicates(db):
    _as_before_27(db)
    _add_product(db, "KB-001")
    _add_product(db, "kb-001")

    init_db(db)

    assert _has_index(db, "users_username_nocase")
    assert not _has_index(db, "products_sku_nocase")


def test_init_db_reports_usernames_differing_only_by_case(db, caplog):
    _as_before_27(db)
    _add_user(db, "carol")
    _add_user(db, "CAROL")

    with caplog.at_level(logging.WARNING, logger="app.db"):
        init_db(db)

    assert "users.username" in caplog.text
    assert "carol" in caplog.text and "CAROL" in caplog.text
    assert _has_index(db, "products_sku_nocase")


def test_init_db_applies_the_rule_once_the_duplicates_are_fixed(db):
    _as_before_27(db)
    _add_product(db, "KB-001")
    _add_product(db, "kb-001")
    init_db(db)

    db.execute("UPDATE products SET sku = 'KB-002' WHERE sku = 'kb-001'")
    db.commit()
    init_db(db)

    assert _has_index(db, "products_sku_nocase")
    with pytest.raises(DuplicateSkuError):
        _add_product(db, "kb-002")


def test_the_app_starts_on_a_database_with_duplicates(db):
    _as_before_27(db)
    _add_product(db, "KB-001")
    _add_product(db, "kb-001")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
