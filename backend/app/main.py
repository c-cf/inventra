from fastapi import FastAPI


def create_app() -> FastAPI:
    """Application factory so tests and the ASGI server share one setup path."""
    return FastAPI(title="Inventra API", version="0.1.0")


app = create_app()
