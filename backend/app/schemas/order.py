from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=200)
    items: list[OrderItemIn] = Field(min_length=1)

    @field_validator("customer_name")
    @classmethod
    def reject_blank_customer(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Customer name must not be blank")
        return value

    @field_validator("items")
    @classmethod
    def reject_duplicate_products(cls, items: list[OrderItemIn]) -> list[OrderItemIn]:
        product_ids = [item.product_id for item in items]
        if len(set(product_ids)) != len(product_ids):
            raise ValueError("Each product may appear only once per order")
        return items


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    sku: str
    name: str
    quantity: int
    unit_price: float
    line_total: float


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    status: str
    created_by: int
    created_at: str
    items: list[OrderItemOut]
    total: float
