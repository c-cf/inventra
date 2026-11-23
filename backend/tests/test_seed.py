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
    assert "Kept user" not in out and "Skipped user" not in out


def test_main_reports_what_was_already_there_on_a_second_run(db, capsys):
    from app.seed import STAFF_USERNAME, main

    main()
    capsys.readouterr()
    main()

    out = capsys.readouterr().out
    kept = "it already exists; its password was not changed."
    assert f"Kept user '{ADMIN_USERNAME}' (admin): {kept}" in out
    assert f"Kept user '{STAFF_USERNAME}' (staff): {kept}" in out
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


def test_main_does_not_add_a_case_duplicate_to_a_database_from_before_27(db, capsys):
    from app.seed import main

    # Before #27 there was no case-insensitive index. With carol and CAROL in the table
    # init_db cannot add it, so nothing in the database refuses a second "admin".
    for index in ("users_username_nocase", "products_sku_nocase"):
        db.execute(f"DROP INDEX IF EXISTS {index}")
    db.commit()
    for username in (ADMIN_USERNAME.upper(), "carol", "CAROL"):
        users.create(db, username=username, password_hash="x", role="staff")

    main()

    out = capsys.readouterr().out
    assert f"Skipped user '{ADMIN_USERNAME}': '{ADMIN_USERNAME.upper()}' already exists" in out
    assert users.get_by_username(db, ADMIN_USERNAME) is None


def test_main_shows_the_role_an_existing_account_really_has(db, capsys):
    from app.seed import main

    # Someone made "admin" a staff account in the app: admin/admin123 is no admin now.
    users.create(db, username=ADMIN_USERNAME, password_hash="x", role="staff")

    main()

    assert f"Kept user '{ADMIN_USERNAME}' (staff):" in capsys.readouterr().out


def test_seed_reports_an_account_taken_while_it_ran(db, monkeypatch):
    from app.seed import STAFF_USERNAME

    # Another writer adds "ADMIN" after seed() looked, so creating "admin" is refused.
    look_up = users.get_by_username_ignoring_case
    raced = []

    def look_up_then_lose_the_race(conn, username):
        if username == ADMIN_USERNAME and not raced:
            raced.append(username)
            users.create(conn, username=ADMIN_USERNAME.upper(), password_hash="x", role="admin")
            return None
        return look_up(conn, username)

    monkeypatch.setattr(users, "get_by_username_ignoring_case", look_up_then_lose_the_race)

    report = seed(db)

    assert report.skipped == ((ADMIN_USERNAME, ADMIN_USERNAME.upper()),)
    assert (STAFF_USERNAME, "staff") in report.created
    assert report.products_added == len(SAMPLE_PRODUCTS)
