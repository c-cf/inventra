import pytest

from app.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_password_is_one_way_and_verifiable():
    hashed = hash_password("correct horse")

    assert hashed != "correct horse"
    assert verify_password("correct horse", hashed)


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("correct horse")

    assert not verify_password("battery staple", hashed)


def test_access_token_round_trips_subject():
    token = create_access_token("42")

    assert decode_access_token(token) == "42"


def test_tampered_token_is_rejected():
    token = create_access_token("42")
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")

    with pytest.raises(TokenError):
        decode_access_token(tampered)


def test_expired_token_is_rejected():
    token = create_access_token("42", expires_minutes=-1)

    with pytest.raises(TokenError):
        decode_access_token(token)
