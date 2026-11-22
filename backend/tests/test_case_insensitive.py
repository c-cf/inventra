"""SKUs and usernames that differ only by letter case are the same identifier (#27)."""

PRODUCT = {"sku": "KB-001", "name": "Keyboard", "price": 89, "quantity": 1}


def test_a_sku_differing_only_by_case_is_a_duplicate(client, auth_headers):
    client.post("/products", json=PRODUCT, headers=auth_headers)

    response = client.post("/products", json={**PRODUCT, "sku": "kb-001"}, headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "SKU already exists"


def test_renaming_to_another_products_sku_in_other_case_is_a_duplicate(client, auth_headers):
    client.post("/products", json=PRODUCT, headers=auth_headers)
    mouse = client.post(
        "/products", json={**PRODUCT, "sku": "MS-001", "name": "Mouse"}, headers=auth_headers
    ).json()

    response = client.patch(
        f"/products/{mouse['id']}", json={"sku": "Kb-001"}, headers=auth_headers
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "SKU already exists"


def test_a_product_can_change_the_case_of_its_own_sku(client, auth_headers):
    keyboard = client.post("/products", json=PRODUCT, headers=auth_headers).json()

    response = client.patch(
        f"/products/{keyboard['id']}", json={"sku": "kb-001"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["sku"] == "kb-001"


def test_a_username_differing_only_by_case_is_a_duplicate(client, auth_headers, staff):
    response = client.post(
        "/users",
        json={"username": "BOB", "password": "bobpass12", "role": "staff"},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Username already exists"
