import pytest

from app.config import get_settings


@pytest.mark.parametrize(
    "name",
    ["INVENTRA_LOGIN_MAX_ATTEMPTS", "INVENTRA_LOGIN_LOCKOUT_SECONDS", "INVENTRA_TOKEN_TTL_MINUTES"],
)
@pytest.mark.parametrize("value", ["0", "-5", "five", ""])
def test_numeric_settings_must_be_positive_integers(monkeypatch, name, value):
    monkeypatch.setenv(name, value)

    with pytest.raises(ValueError, match=name):
        get_settings()


def test_defaults_are_used_when_nothing_is_set(monkeypatch):
    for name in (
        "INVENTRA_LOGIN_MAX_ATTEMPTS",
        "INVENTRA_LOGIN_LOCKOUT_SECONDS",
        "INVENTRA_TOKEN_TTL_MINUTES",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = get_settings()

    assert (settings.login_max_attempts, settings.login_lockout_seconds) == (5, 300)
    assert settings.token_ttl_minutes == 60
