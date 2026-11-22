from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.limits import MAX_PRICE, MAX_QUANTITY


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0, le=MAX_PRICE, allow_inf_nan=False)
    quantity: int = Field(default=0, ge=0, le=MAX_QUANTITY)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    price: float | None = Field(default=None, ge=0, le=MAX_PRICE, allow_inf_nan=False)

    @field_validator("name", "price", "sku")
    @classmethod
    def reject_null(cls, value):
        if value is None:
            raise ValueError("must not be null")
        return value


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    price: float
    quantity: int
    created_at: str


class StockAdjustment(BaseModel):
    change: int = Field(ge=-MAX_QUANTITY, le=MAX_QUANTITY)
    reason: str = Field(min_length=1)

    @field_validator("change")
    @classmethod
    def validate_change(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Stock change cannot be zero")
        return value

    @field_validator("reason")
    @classmethod
    def reject_blank_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Reason must not be blank")
        return value


class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    change: int
    reason: str
    created_at: str
