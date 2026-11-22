"""Any signed-in user can change their own password."""

import pytest


def change(client, headers, current: str, new: str):
    return client.post(
        "/auth/password",
        json={"current_password": current, "new_password": new},
        headers=headers,
    )


def login(client, username: str, password: str) -> int:
    return client.post("/auth/login", json={"username": username, "password": password}).status_code


def test_changing_the_password_requires_auth(client):
    response = client.post(
        "/auth/password", json={"current_password": "a", "new_password": "newpassword1"}
    )

    assert response.status_code == 401


def test_staff_changes_their_own_password(client, staff_headers):
    response = change(client, staff_headers, "staffpass1", "brand-new-pass")

    assert response.status_code == 204
    assert login(client, "bob", "brand-new-pass") == 200
    assert login(client, "bob", "staffpass1") == 401


def test_a_wrong_current_password_is_rejected(client, staff_headers):
    response = change(client, staff_headers, "not-my-password", "brand-new-pass")

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"
    assert login(client, "bob", "staffpass1") == 200


@pytest.mark.parametrize("new", ["short7!", "é" * 37])
def test_the_new_password_must_be_valid(client, staff_headers, new):
    assert change(client, staff_headers, "staffpass1", new).status_code == 422


def test_an_overlong_current_password_is_just_incorrect(client, staff_headers):
    assert change(client, staff_headers, "é" * 40, "brand-new-pass").status_code == 400
