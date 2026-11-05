from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbConn
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
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


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser) -> UserOut:
    return UserOut(id=current_user.id, username=current_user.username, role=current_user.role)
