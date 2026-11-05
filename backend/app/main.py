from fastapi import FastAPI

from app.routers import health


def create_app() -> FastAPI:
    """Application factory so tests and the ASGI server share one setup path."""
    app = FastAPI(title="Inventra API", version="0.1.0")
    app.include_router(health.router)
    return app


app = create_app()
