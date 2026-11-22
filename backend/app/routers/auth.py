from fastapi import APIRouter, HTTPException, Response, status

from app.deps import CurrentUser, DbConn
from app.repositories import users
from app.schemas.auth import LoginRequest, PasswordChange, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password
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


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, conn: DbConn, current_user: CurrentUser) -> Response:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    users.update_password_hash(conn, current_user.id, hash_password(payload.new_password))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
