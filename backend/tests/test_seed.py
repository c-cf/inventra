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


def test_seed_creates_a_staff_account_that_can_log_in(client, db):
    from app.seed import STAFF_PASSWORD, STAFF_USERNAME

    seed(db)
    seed(db)

    staff = users.get_by_username(db, STAFF_USERNAME)
    assert staff is not None and staff.role == "staff"
    response = client.post(
        "/auth/login", json={"username": STAFF_USERNAME, "password": STAFF_PASSWORD}
    )
    assert response.status_code == 200


def test_seed_skips_an_account_whose_username_exists_in_another_case(db):
    from app.seed import STAFF_USERNAME

    users.create(db, username=ADMIN_USERNAME.upper(), password_hash="x", role="admin")

    seed(db)

    assert users.get_by_username(db, ADMIN_USERNAME) is None
    assert users.get_by_username(db, STAFF_USERNAME) is not None


def test_main_reports_the_accounts_and_products_it_created(db, capsys):
    from app.seed import STAFF_USERNAME, main

    main()

    out = capsys.readouterr().out
    assert f"Created user '{ADMIN_USERNAME}' (admin)." in out
    assert f"Created user '{STAFF_USERNAME}' (staff)." in out
    assert f"Added {len(SAMPLE_PRODUCTS)} of {len(SAMPLE_PRODUCTS)} sample products." in out


def test_main_reports_what_was_already_there_on_a_second_run(db, capsys):
    from app.seed import STAFF_USERNAME, main

    main()
    capsys.readouterr()
    main()

    out = capsys.readouterr().out
    assert f"Kept user '{ADMIN_USERNAME}': it already exists." in out
    assert f"Kept user '{STAFF_USERNAME}': it already exists." in out
    assert f"Added 0 of {len(SAMPLE_PRODUCTS)} sample products." in out
    assert "Created user" not in out


def test_main_says_which_account_it_skipped_and_why(db, capsys):
    from app.seed import STAFF_USERNAME, main

    users.create(db, username=ADMIN_USERNAME.upper(), password_hash="x", role="admin")

    main()

    out = capsys.readouterr().out
    assert (
        f"Skipped user '{ADMIN_USERNAME}': '{ADMIN_USERNAME.upper()}' already exists "
        "and usernames ignore letter case." in out
    )
    assert f"Created user '{STAFF_USERNAME}' (staff)." in out
    assert f"Created user '{ADMIN_USERNAME}'" not in out
