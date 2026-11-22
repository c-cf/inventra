import os
from dataclasses import dataclass

# Long enough to satisfy PyJWT's 32-byte HS256 minimum; override in real deployments.
DEV_SECRET_KEY = "dev-only-secret-change-me-before-deploying-0000"


@dataclass(frozen=True)
class Settings:
    db_path: str
    secret_key: str
    token_ttl_minutes: int
    cors_origins: list[str]
    login_max_attempts: int
    login_lockout_seconds: int
    login_max_attempts_per_client: int
    cookie_secure: bool


def _positive_int(name: str, default: str) -> int:
    raw = os.getenv(name, default)
    try:
        value = int(raw)
    except ValueError:
        raise ValueError(f"{name} must be a positive integer, got {raw!r}") from None
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer, got {raw!r}")
    return value


def get_settings() -> Settings:
    """Read configuration from the environment on every call.

    Reading lazily (rather than once at import time) keeps tests free to point
    the app at a temporary database via monkeypatched environment variables.
    """
    return Settings(
        db_path=os.getenv("INVENTRA_DB_PATH", "inventra.db"),
        secret_key=os.getenv("INVENTRA_SECRET_KEY", DEV_SECRET_KEY),
        token_ttl_minutes=_positive_int("INVENTRA_TOKEN_TTL_MINUTES", "60"),
        cors_origins=[
            origin.strip()
            for origin in os.getenv("INVENTRA_CORS_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        ],
        login_max_attempts=_positive_int("INVENTRA_LOGIN_MAX_ATTEMPTS", "5"),
        login_lockout_seconds=_positive_int("INVENTRA_LOGIN_LOCKOUT_SECONDS", "300"),
        login_max_attempts_per_client=_positive_int("INVENTRA_LOGIN_MAX_ATTEMPTS_PER_CLIENT", "20"),
        # Send the session cookie over HTTPS only; turn on anywhere that is not plain localhost.
        cookie_secure=os.getenv("INVENTRA_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"},
    )
