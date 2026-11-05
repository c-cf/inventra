from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import connect, init_db
from app.routers import auth, health, products


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Make sure the schema exists before the first request is served."""
    conn = connect()
    try:
        init_db(conn)
    finally:
        conn.close()
    yield


def create_app() -> FastAPI:
    """Application factory so tests and the ASGI server share one setup path."""
    app = FastAPI(title="Inventra API", version="0.1.0", lifespan=lifespan)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(products.router)
    return app


app = create_app()
