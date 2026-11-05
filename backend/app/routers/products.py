from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbConn
from app.repositories import products
from app.repositories.products import DuplicateSkuError
from app.schemas.product import ProductCreate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(conn: DbConn, _: CurrentUser) -> list[ProductOut]:
    return [ProductOut.model_validate(p) for p in products.list_all(conn)]


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
