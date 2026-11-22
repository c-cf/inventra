from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.deps import AdminUser, DbConn
from app.repositories import users
from app.schemas.auth import RoleUpdate, UserCreate, UserSummary
from app.schemas.limits import MAX_ID
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])

UserId = Annotated[int, Path(ge=1, le=MAX_ID)]


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


@router.patch("/{user_id}", response_model=UserSummary)
def change_role(
    user_id: UserId, payload: RoleUpdate, conn: DbConn, admin: AdminUser
) -> UserSummary:
    if user_id == admin.id:
        # Keeps the last admin from locking everyone out of user management.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You cannot change your own role"
        )
    if users.get_by_id(conn, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = users.update_role(conn, user_id, payload.role)
    assert user is not None
    return UserSummary.model_validate(user)
