from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import get_settings

ALGORITHM = "HS256"


class TokenError(Exception):
    """Raised when an access token cannot be decoded or has expired."""


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


# bcrypt only reads 72 bytes; bcrypt>=5 raises instead of silently truncating.
BCRYPT_MAX_BYTES = 72


def verify_password(plain: str, hashed: str) -> bool:
    encoded = plain.encode()
    if len(encoded) > BCRYPT_MAX_BYTES:
        return False  # no stored password can be this long, so it cannot match
    return bcrypt.checkpw(encoded, hashed.encode())


def create_access_token(subject: str, *, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    ttl = settings.token_ttl_minutes if expires_minutes is None else expires_minutes
    now = datetime.now(UTC)
    payload = {"sub": subject, "iat": now, "exp": now + timedelta(minutes=ttl)}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise TokenError("token has no subject")
    return subject
