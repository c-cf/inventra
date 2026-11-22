from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.limits import MAX_ID
from app.schemas.timestamps import UtcTimestamp

OrderStatus = Literal["pending", "paid", "shipped", "cancelled"]


MAX_ORDER_QUANTITY = 1_000_000


class OrderItemIn(BaseModel):
    product_id: int = Field(gt=0, le=MAX_ID)
    quantity: int = Field(gt=0, le=MAX_ORDER_QUANTITY)


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


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


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
    status: OrderStatus
    created_by: int
    created_at: UtcTimestamp
    items: list[OrderItemOut]
    total: float
