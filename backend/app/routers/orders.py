from fastapi import APIRouter, status

from app.deps import CurrentUser, DbConn
from app.schemas.order import OrderCreate, OrderOut
from app.services import orders as order_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, conn: DbConn, current_user: CurrentUser) -> OrderOut:
    order = order_service.place_order(
        conn,
        customer_name=payload.customer_name,
        items=[(item.product_id, item.quantity) for item in payload.items],
        created_by=current_user.id,
    )
    return OrderOut.model_validate(order)
