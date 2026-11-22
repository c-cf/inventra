"""Shared FastAPI dependencies, exposed as Annotated aliases for route signatures."""

import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import get_db
from app.models import User
from app.repositories import users
from app.security import SESSION_COOKIE, TokenError, decode_access_token

DbConn = Annotated[sqlite3.Connection, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(conn: DbConn, credentials: BearerCredentials, request: Request) -> User:
    """Authenticate with a bearer token (API clients) or the session cookie (browsers)."""
    token = credentials.credentials if credentials else request.cookies.get(SESSION_COOKIE)
    if token is None:
        raise _unauthorized()
    try:
        user_id = int(decode_access_token(token))
    except (TokenError, ValueError):
        raise _unauthorized() from None
    user = users.get_by_id(conn, user_id)
    if user is None:
        raise _unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(current_user: CurrentUser) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return current_user


AdminUser = Annotated[User, Depends(require_admin)]
