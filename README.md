# Inventra

Order & inventory management system, built test-first.

[![CI](https://github.com/c-cf/inventra/actions/workflows/ci.yml/badge.svg)](https://github.com/c-cf/inventra/actions/workflows/ci.yml)

| Layer    | Stack                                                   | Tests                                   |
| -------- | ------------------------------------------------------- | --------------------------------------- |
| Backend  | Python 3.12, FastAPI, SQLite (stdlib `sqlite3`), PyJWT  | pytest + Starlette `TestClient`         |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4     | Vitest + React Testing Library (jsdom)  |

## What works today

- Sign in with a seeded admin account and receive a JWT bearer token.
- `GET /auth/me` resolves the current user from the token.
- Products: list, create (409 on duplicate SKU, 422 on bad input) and get by id.
- Web UI: `/login` form and a `/products` table with an out-of-stock badge and
  sign-out; unauthenticated visitors are bounced to `/login`.

Everything else (orders, stock movements, roles, …) is on the
[roadmap](#roadmap) and waiting for a red test.

## Repository layout

```
inventra/
├── backend/
│   ├── app/
│   │   ├── main.py          # app factory, lifespan (schema init), CORS, routers
│   │   ├── config.py        # Settings read from INVENTRA_* env vars
│   │   ├── db.py            # sqlite3 connection helpers + get_db dependency
│   │   ├── schema.sql       # idempotent DDL (users, products)
│   │   ├── security.py      # bcrypt password hashing, JWT create/decode
│   │   ├── deps.py          # DbConn / CurrentUser dependency aliases
│   │   ├── models.py        # frozen dataclasses mirroring table rows
│   │   ├── schemas/         # pydantic request/response models
│   │   ├── repositories/    # plain SQL per table, returns models
│   │   ├── services/        # business rules spanning repositories
│   │   ├── routers/         # thin HTTP layer: health, auth, products
│   │   └── seed.py          # dev seed: admin user + sample products
│   ├── tests/               # one test module per feature + conftest fixtures
│   └── pyproject.toml       # deps, pytest and ruff config (managed by uv)
├── frontend/
│   ├── src/
│   │   ├── app/             # routes: / (redirect), /login, /products
│   │   ├── components/      # LoginForm, ProductTable, AppHeader
│   │   └── lib/             # api.ts (typed client), auth.ts (token storage)
│   ├── vitest.config.mts
│   └── package.json
└── .github/workflows/ci.yml # ruff + pytest, eslint + tsc + vitest + next build
```

### Backend request flow

```
HTTP ──▶ routers (validate with schemas, map errors to status codes)
            │
            ▼
         services (business rules, e.g. authenticate)
            │
            ▼
       repositories (SQL, return models)  ──▶  SQLite file
```

Routers never write SQL; repositories never raise `HTTPException`. Auth is a
dependency (`CurrentUser`) that any route can require by adding a parameter.

### Frontend

Pages under `src/app` are thin: they read the token, call `src/lib/api.ts` and
render components from `src/components`. Components and `lib/` are unit tested
with the router and API client mocked; pages are tested the same way.

## Getting started

Prerequisites: [uv](https://docs.astral.sh/uv/) (it downloads Python 3.12 for
you) and Node.js 20+ with npm.

### Backend

```bash
cd backend
uv sync                        # creates .venv with runtime + dev deps
uv run python -m app.seed      # creates inventra.db, admin user, sample products
uv run uvicorn app.main:app --reload
```

API docs: <http://localhost:8000/docs>. Configuration is read from
`INVENTRA_*` environment variables (see `backend/.env.example`); defaults
work for local development.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open <http://localhost:3000> and sign in with the seeded account defined in
`backend/app/seed.py` (username `admin`, password `admin123`).

## Running the tests

```bash
# backend
cd backend && uv run pytest            # add -v for names, -k <expr> to filter
cd backend && uv run ruff check . && uv run ruff format --check .

# frontend
cd frontend && npm test                # vitest run
cd frontend && npm run test:watch      # re-runs on save while you work
cd frontend && npm run lint && npm run typecheck
```

CI runs all of the above (plus `next build`) on every push and pull request.

## API overview

| Method | Path             | Auth   | Description                                  |
| ------ | ---------------- | ------ | -------------------------------------------- |
| GET    | `/health`        | –      | Liveness check                               |
| POST   | `/auth/login`    | –      | `{username, password}` → bearer token        |
| GET    | `/auth/me`       | Bearer | Current user `{id, username, role}`          |
| GET    | `/products`      | Bearer | List products                                |
| POST   | `/products`      | Bearer | Create product (201; 409 on duplicate SKU)   |
| GET    | `/products/{id}` | Bearer | Product by id (404 when missing)             |

## TDD workflow and commit conventions

This project is developed red → green → refactor, and the git history is
meant to show it. Each step is its own commit:

| Step     | Commit prefix                       | Rule                                                                   |
| -------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Red      | `test(scope): …`                    | Add a failing test. Run it; it must fail for the *right* reason.       |
| Green    | `feat(scope): …` / `fix(scope): …`  | The smallest change that makes the suite pass. Nothing speculative.    |
| Refactor | `refactor(scope): …`                | Improve structure with the suite still green. No behaviour change.     |

`scope` is `backend` or `frontend`. Other prefixes: `chore`, `docs`, `ci`.
Example from the log:

```
test(backend): add failing login endpoint tests
feat(backend): add POST /auth/login issuing JWT access tokens
refactor(backend): extract credential check into an auth service
```

Guidelines:

- One behaviour per red commit. If you need three tests, that is fine; if
  you need three features, that is three cycles.
- Never commit a red test together with its implementation, and never
  squash the red commit away when merging.
- Test at the boundary that matters: HTTP tests for routers (via
  `TestClient`), direct tests for repositories/services, component tests for
  the UI. Mock only what you do not own (`fetch`, `next/navigation`).
- Keep fixtures in `backend/tests/conftest.py` (`client`, `db`, `user`,
  `auth_headers`) and `frontend/vitest.setup.ts`.

## Roadmap

Open work, roughly in dependency order. Each bullet is a small set of
red/green/refactor cycles; claim one by opening an issue or a draft PR.

**Backend**

- Orders: `orders` + `order_items` tables; `POST /orders` creates an order
  and decrements stock atomically (reject when stock is insufficient);
  `GET /orders`, `GET /orders/{id}`; status transitions
  (`pending → paid → shipped`, `cancelled` restores stock).
- Inventory: `stock_movements` audit table; `POST /products/{id}/adjust`
  with a reason; low-stock listing (`GET /products?below=<n>`).
- Products: update and delete, search by name/SKU, pagination.
- Users and roles: `admin` vs `staff` enforcement (e.g. only admins delete),
  user management endpoints, password change.
- Hardening: constant-time login (hash a dummy password on unknown user),
  token refresh/expiry handling, structured error responses.

**Frontend**

- Orders page and a create-order form (pick products, quantities, live total).
- Inventory page: adjust stock, show movement history, highlight low stock.
- Product create/edit forms with validation that mirrors the API.
- Move the token to an httpOnly cookie and protect routes with middleware
  instead of the client-side redirect.
- End-to-end tests with Playwright against the seeded backend.

**Infrastructure**

- Dockerfiles and a `docker-compose.yml` for one-command startup.
- Coverage reports in CI.

## Contributing

1. Branch from `main`: `feat/orders-api`, `feat/orders-page`, `fix/…`.
2. Work in red/green/refactor commits as described above.
3. Open a pull request; CI must be green. In the description, list the
   cycles (which tests were added, what they drove).
4. One approval from another team member, then squash is **not** used:
   merge with a merge commit so the cycle history survives.
