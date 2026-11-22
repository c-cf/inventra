"""Staff can do everything except delete products and manage users."""


def test_staff_can_work_with_products_stock_and_orders(client, staff_headers):
    product = client.post(
        "/products",
        json={"sku": "ST-1", "name": "Staff product", "price": 5, "quantity": 10},
        headers=staff_headers,
    ).json()
    pid = product["id"]

    assert client.get("/products", headers=staff_headers).status_code == 200
    assert (
        client.patch(f"/products/{pid}", json={"price": 6}, headers=staff_headers).status_code
        == 200
    )
    adjust = client.post(
        f"/products/{pid}/adjust", json={"change": 2, "reason": "restock"}, headers=staff_headers
    )
    assert adjust.status_code == 200
    assert client.get(f"/products/{pid}/movements", headers=staff_headers).status_code == 200
    order = client.post(
        "/orders",
        json={"customer_name": "ACME", "items": [{"product_id": pid, "quantity": 1}]},
        headers=staff_headers,
    )
    assert order.status_code == 201
    oid = order.json()["id"]
    assert client.get("/orders", headers=staff_headers).status_code == 200
    assert (
        client.patch(f"/orders/{oid}", json={"status": "paid"}, headers=staff_headers).status_code
        == 200
    )
