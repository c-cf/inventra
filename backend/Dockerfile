# Inventra API: FastAPI on uvicorn, SQLite stored in the /data volume.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first so code changes don't invalidate this layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY app ./app

RUN useradd --create-home --uid 10001 inventra \
    && mkdir /data \
    && chown inventra /data

ENV PATH="/app/.venv/bin:$PATH" \
    INVENTRA_DB_PATH=/data/inventra.db

USER inventra
VOLUME /data
EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# INVENTRA_SEED=1 creates the demo admin/staff accounts and sample products (idempotent).
CMD ["sh", "-c", "if [ \"${INVENTRA_SEED:-0}\" = 1 ]; then python -m app.seed; fi; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
