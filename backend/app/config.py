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


def get_settings() -> Settings:
    """Read configuration from the environment on every call.

    Reading lazily (rather than once at import time) keeps tests free to point
    the app at a temporary database via monkeypatched environment variables.
    """
    return Settings(
        db_path=os.getenv("INVENTRA_DB_PATH", "inventra.db"),
        secret_key=os.getenv("INVENTRA_SECRET_KEY", DEV_SECRET_KEY),
        token_ttl_minutes=int(os.getenv("INVENTRA_TOKEN_TTL_MINUTES", "60")),
        cors_origins=[
            origin.strip()
            for origin in os.getenv("INVENTRA_CORS_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        ],
        login_max_attempts=int(os.getenv("INVENTRA_LOGIN_MAX_ATTEMPTS", "5")),
        login_lockout_seconds=int(os.getenv("INVENTRA_LOGIN_LOCKOUT_SECONDS", "300")),
    )
