"""Shared FastAPI dependencies, exposed as Annotated aliases for route signatures."""

import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import get_db
from app.models import User
from app.repositories import users
from app.security import TokenError, decode_access_token

DbConn = Annotated[sqlite3.Connection, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(conn: DbConn, credentials: BearerCredentials) -> User:
    if credentials is None:
        raise _unauthorized()
    try:
        user_id = int(decode_access_token(credentials.credentials))
    except (TokenError, ValueError):
        raise _unauthorized() from None
    user = users.get_by_id(conn, user_id)
    if user is None:
        raise _unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
