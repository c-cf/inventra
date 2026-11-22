"""Plain records returned by the repository layer (one per table row)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    username: str
    password_hash: str
    role: str
    created_at: str


@dataclass(frozen=True)
class Product:
    id: int
    sku: str
    name: str
    price: float
    quantity: int
    created_at: str


@dataclass(frozen=True)
class StockMovement:
    id: int
    product_id: int
    change: int
    reason: str
    created_at: str


@dataclass(frozen=True)
class OrderItem:
    product_id: int
    sku: str
    name: str
    quantity: int
    unit_price: float

    @property
    def line_total(self) -> float:
        return round(self.quantity * self.unit_price, 2)


@dataclass(frozen=True)
class Order:
    id: int
    customer_name: str
    status: str
    created_by: int
    created_at: str
    items: tuple[OrderItem, ...]

    @property
    def total(self) -> float:
        return round(sum(item.line_total for item in self.items), 2)
