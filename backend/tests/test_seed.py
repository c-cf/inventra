from app.repositories import products, users
from app.seed import ADMIN_PASSWORD, ADMIN_USERNAME, SAMPLE_PRODUCTS, seed


def test_seed_creates_an_admin_and_sample_products(db):
    seed(db)

    admin = users.get_by_username(db, ADMIN_USERNAME)
    assert admin is not None
    assert admin.role == "admin"
    assert [p.sku for p in products.list_all(db)] == [p["sku"] for p in SAMPLE_PRODUCTS]


def test_seed_is_idempotent(db):
    seed(db)
    seed(db)

    assert len(products.list_all(db)) == len(SAMPLE_PRODUCTS)


def test_seeded_admin_can_log_in(client, db):
    seed(db)

    response = client.post(
        "/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )

    assert response.status_code == 200
