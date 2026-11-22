"""User management: admins manage accounts, staff cannot."""


def test_list_users_requires_auth(client):
    assert client.get("/users").status_code == 401


def test_staff_cannot_list_users(client, staff_headers):
    response = client.get("/users", headers=staff_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role required"


def test_admin_lists_users_without_password_hashes(client, auth_headers, user, staff):
    response = client.get("/users", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert [(u["username"], u["role"]) for u in body] == [("alice", "admin"), ("bob", "staff")]
    assert all(set(u) == {"id", "username", "role", "created_at"} for u in body)
