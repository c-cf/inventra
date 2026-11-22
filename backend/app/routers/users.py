from fastapi import APIRouter

from app.deps import AdminUser, DbConn
from app.repositories import users
from app.schemas.auth import UserSummary

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserSummary])
def list_users(conn: DbConn, _: AdminUser) -> list[UserSummary]:
    return [UserSummary.model_validate(user) for user in users.list_all(conn)]
