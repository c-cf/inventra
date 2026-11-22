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
