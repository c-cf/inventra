
def test_increase_stock(client, auth_headers):
    payload = {
        "sku": "SKU-INV-001",
        "name": "Test Product",
        "price": 100.0,
        "quantity": 10,
    }

    response = client.post(
        "/products",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 201
    product_id = response.json()["id"]

    response = client.post(
        f"/products/{product_id}/adjust",
        json={
            "change": 5,
            "reason": "restock",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 15

    # 3. 再查詢商品，確認資料庫中的庫存真的更新
    response = client.get(
        f"/products/{product_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["quantity"] == 15
