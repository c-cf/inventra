from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0)
    quantity: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    price: float | None = Field(default=None, ge=0)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    price: float
    quantity: int
    created_at: str
