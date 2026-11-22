import sqlite3

import pytest

from app.repositories import products


def test_update_does_not_report_a_null_sku_as_a_duplicate(db):
    product = products.create(db, sku="SKU-001", name="Widget", price=9.99)

    with pytest.raises(sqlite3.IntegrityError):
        products.update(db, product.id, sku=None)
