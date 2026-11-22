from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbConn
from app.repositories import orders
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate
from app.services import orders as order_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
def list_orders(conn: DbConn, _: CurrentUser) -> list[OrderOut]:
    return [OrderOut.model_validate(order) for order in orders.list_all(conn)]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, conn: DbConn, _: CurrentUser) -> OrderOut:
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
    order_id: int, payload: OrderStatusUpdate, conn: DbConn, _: CurrentUser
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
