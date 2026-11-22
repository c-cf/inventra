from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.security import BCRYPT_MAX_BYTES


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    role: str


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    created_at: str


Role = Literal["admin", "staff"]


def check_password_strength(value: str) -> str:
    """Shared rule for new passwords: 8+ characters and within bcrypt's 72 bytes."""
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value.encode()) > BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be at most {BCRYPT_MAX_BYTES} bytes")
    return value


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=150, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str
    role: Role

    @field_validator("password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        return check_password_strength(value)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        return check_password_strength(value)


class RoleUpdate(BaseModel):
    role: Role
