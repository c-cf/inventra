from fastapi import APIRouter, HTTPException, Query, Response, status

from app.deps import CurrentUser, DbConn
from app.repositories import products
from app.repositories.products import DuplicateSkuError
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockAdjustment,
    StockMovementOut,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    conn: DbConn,
    _: CurrentUser,
    response: Response,
    below: int | None = Query(default=None, ge=0),
    q: str | None = Query(default=None, max_length=100),
    limit: int | None = Query(default=None, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[ProductOut]:
    search = q.strip() if q else None
    items = products.find(conn, q=search, below=below, limit=limit, offset=offset)
    response.headers["X-Total-Count"] = str(products.count(conn, q=search, below=below))
    return [ProductOut.model_validate(item) for item in items]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, conn: DbConn, _: CurrentUser) -> ProductOut:
    try:
        product = products.create(conn, **payload.model_dump())
    except DuplicateSkuError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="SKU already exists"
        ) from None
    return ProductOut.model_validate(product)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, conn: DbConn, _: CurrentUser) -> ProductOut:
    product = products.get_by_id(conn, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductOut.model_validate(product)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int, payload: ProductUpdate, conn: DbConn, _: CurrentUser
) -> ProductOut:
    try:
        product = products.update(conn, product_id, **payload.model_dump(exclude_unset=True))
    except DuplicateSkuError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="SKU already exists"
        ) from None
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductOut.model_validate(product)


@router.post("/{product_id}/adjust", response_model=ProductOut)
def adjust_stock(
    product_id: int,
    payload: StockAdjustment,
    conn: DbConn,
    _: CurrentUser,
) -> ProductOut:
    try:
        product = products.adjust_stock(
            conn,
            product_id,
            payload.change,
            payload.reason,
        )
    except products.InsufficientStockError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Insufficient stock",
        ) from None

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return ProductOut.model_validate(product)


@router.get("/{product_id}/movements", response_model=list[StockMovementOut])
def get_stock_movements(
    product_id: int,
    conn: DbConn,
    _: CurrentUser,
) -> list[StockMovementOut]:
    product = products.get_by_id(conn, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    movements = products.get_stock_movements(conn, product_id)

    return [StockMovementOut.model_validate(movement) for movement in movements]


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, conn: DbConn, _: CurrentUser) -> Response:
    try:
        deleted = products.delete(conn, product_id)
    except products.ProductInUseError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product has orders and cannot be deleted",
        ) from None
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
