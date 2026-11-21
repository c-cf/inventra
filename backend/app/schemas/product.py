from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0)
    quantity: int = Field(default=0, ge=0)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    price: float
    quantity: int
    created_at: str


class StockAdjustment(BaseModel):
    change: int
    reason: str = Field(min_length=1)

    @field_validator("change")
    @classmethod
    def validate_change(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Stock change cannot be zero")
        return value
