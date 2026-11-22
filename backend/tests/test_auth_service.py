"""authenticate() must not reveal which usernames exist through its timing."""

from app.security import hash_password
from app.services import auth as auth_service


def test_unknown_user_still_checks_a_password_hash(db, monkeypatch):
    checked: list[str] = []

    def spy(plain: str, hashed: str) -> bool:
        checked.append(hashed)
        return False

    monkeypatch.setattr(auth_service, "verify_password", spy)

    assert auth_service.authenticate(db, "ghost", "whatever") is None
    assert len(checked) == 1
    # Same algorithm and cost as a stored hash ("$2b$12$"), so the work matches a real check.
    assert checked[0][:7] == hash_password("anything")[:7]


def test_known_user_with_wrong_password_is_rejected(db, user):
    assert auth_service.authenticate(db, "alice", "wrong") is None


def test_known_user_with_right_password_is_returned(db, user):
    assert auth_service.authenticate(db, "alice", "secret123") == user
