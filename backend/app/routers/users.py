from fastapi import APIRouter, HTTPException, status

from app.deps import AdminUser, DbConn
from app.repositories import users
from app.schemas.auth import UserCreate, UserSummary
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserSummary])
def list_users(conn: DbConn, _: AdminUser) -> list[UserSummary]:
    return [UserSummary.model_validate(user) for user in users.list_all(conn)]


@router.post("", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, conn: DbConn, _: AdminUser) -> UserSummary:
    try:
        user = users.create(
            conn,
            username=payload.username,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
    except users.DuplicateUsernameError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username already exists"
        ) from None
    return UserSummary.model_validate(user)
