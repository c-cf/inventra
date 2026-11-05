from fastapi import APIRouter, HTTPException, status

from app.deps import DbConn
from app.schemas.auth import LoginRequest, TokenResponse
from app.security import create_access_token
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, conn: DbConn) -> TokenResponse:
    user = auth_service.authenticate(conn, payload.username, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    return TokenResponse(access_token=create_access_token(str(user.id)))
