from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import connect, init_db
from app.login_throttle import LoginThrottle
from app.routers import auth, health, orders, products


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Make sure the schema exists before the first request is served."""
    settings = get_settings()
    app.state.login_throttle = LoginThrottle(
        max_attempts=settings.login_max_attempts,
        lockout_seconds=settings.login_lockout_seconds,
        max_attempts_per_client=settings.login_max_attempts_per_client,
    )
    conn = connect()
    try:
        init_db(conn)
    finally:
        conn.close()
    yield


def create_app() -> FastAPI:
    """Application factory so tests and the ASGI server share one setup path."""
    app = FastAPI(title="Inventra API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(products.router)
    app.include_router(orders.router)
    return app


app = create_app()
