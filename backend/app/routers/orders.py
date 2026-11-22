from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.deps import CurrentUser, DbConn
from app.repositories import orders
from app.schemas.limits import MAX_ID
from app.schemas.order import OrderCreate, OrderOut, OrderStatus, OrderStatusUpdate
from app.services import orders as order_service

router = APIRouter(prefix="/orders", tags=["orders"])

OrderId = Annotated[int, Path(gt=0, le=MAX_ID)]


@router.get("", response_model=list[OrderOut])
def list_orders(
    conn: DbConn,
    _: CurrentUser,
    # Aliased so the parameter does not shadow fastapi's `status` module.
    order_status: Annotated[OrderStatus | None, Query(alias="status")] = None,
) -> list[OrderOut]:
    found = orders.list_all(conn, status=order_status)
    return [OrderOut.model_validate(order) for order in found]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: OrderId, conn: DbConn, _: CurrentUser) -> OrderOut:
    order = orders.get_by_id(conn, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderOut.model_validate(order)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, conn: DbConn, current_user: CurrentUser) -> OrderOut:
    try:
        order = order_service.place_order(
            conn,
            customer_name=payload.customer_name,
            items=[(item.product_id, item.quantity) for item in payload.items],
            created_by=current_user.id,
        )
    except order_service.ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {exc.product_id} not found",
        ) from None
    except order_service.InsufficientStockError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock for {exc.sku}",
        ) from None
    return OrderOut.model_validate(order)


@router.patch("/{order_id}", response_model=OrderOut)
def update_order_status(
    order_id: OrderId, payload: OrderStatusUpdate, conn: DbConn, _: CurrentUser
) -> OrderOut:
    try:
        order = order_service.change_status(conn, order_id, payload.status)
    except order_service.InvalidStatusTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change an order from {exc.current} to {exc.target}",
        ) from None
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderOut.model_validate(order)
