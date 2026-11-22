# Inventra

Order & inventory management system, built test-first.

[![CI](https://github.com/c-cf/inventra/actions/workflows/ci.yml/badge.svg)](https://github.com/c-cf/inventra/actions/workflows/ci.yml)

| Layer    | Stack                                                   | Tests                                              |
| -------- | ------------------------------------------------------- | -------------------------------------------------- |
| Backend  | Python 3.12, FastAPI, SQLite (stdlib `sqlite3`), PyJWT  | pytest + Starlette `TestClient`, pytest-cov        |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4     | Vitest + React Testing Library (jsdom), v8 coverage |
| System   | Docker Compose                                          | Playwright end-to-end tests, CI smoke test         |

Testing documentation: **[Test plan](docs/TEST_PLAN.md)** · **[Test report](docs/TEST_REPORT.md)**

## What works

- **Sign-in** with an httpOnly session cookie (no token in page scripts), sign-out, server-side route guard, uniform login timing and throttling of repeated failed logins.
- **Roles:** `admin` and `staff`. Admins manage users (`/users`) and are the only ones who can delete products; everyone can change their own password (`/account`).
- **Products:** create, list, search by name/SKU, paginate (API), edit and delete on a detail page (`/products/{id}`); ordered products can't be deleted.
- **Inventory:** stock adjustments with a reason, an audit trail of stock movements, low-stock filter; stock can never go negative.
- **Orders:** place an order with several lines (stock is taken atomically, all or nothing), list and filter by status, order detail page, `pending → paid → shipped`, and cancelling (before shipping) puts the stock back.

Seeded accounts for local use: `admin` / `admin123` and `staff` / `staff123`.

## Repository layout

```
inventra/
├── backend/
│   ├── app/
│   │   ├── main.py          # app factory, lifespan (schema, login throttle), CORS, routers
│   │   ├── config.py        # Settings read (and validated) from INVENTRA_* env vars
│   │   ├── db.py            # sqlite3 connection helpers + get_db dependency
│   │   ├── schema.sql       # idempotent DDL: users, products, stock_movements, orders, order_items
│   │   ├── security.py      # bcrypt hashing, JWT create/decode, session cookie name
│   │   ├── deps.py          # DbConn / CurrentUser / AdminUser, CSRF Origin check for cookies
│   │   ├── login_throttle.py# in-memory failed-login throttle
│   │   ├── errors.py        # JSON-safe validation error handler
│   │   ├── models.py        # frozen dataclasses mirroring table rows
│   │   ├── schemas/         # pydantic request/response models and numeric limits
│   │   ├── repositories/    # plain SQL per table, returns models
│   │   ├── services/        # business rules spanning repositories (auth, orders)
│   │   ├── routers/         # thin HTTP layer: health, auth, products, orders, users
│   │   └── seed.py          # dev seed: admin + staff accounts and sample products
│   ├── tests/               # one test module per feature + conftest fixtures
│   ├── Dockerfile
│   └── pyproject.toml       # deps, pytest, coverage and ruff config (managed by uv)
├── frontend/
│   ├── src/
│   │   ├── app/             # routes: /login, /products(/[id]), /orders(/new, /[id]), /users, /account
│   │   ├── components/      # forms, tables and detail views, each with a *.test.tsx
│   │   ├── lib/             # api.ts (typed client), useAuthedLoad, formatting, validation helpers
│   │   └── proxy.ts         # redirects requests without a session cookie to /login
│   ├── e2e/                 # Playwright end-to-end specs
│   ├── playwright.config.ts # starts a seeded API and the production UI build for e2e
│   ├── vitest.config.mts    # unit/component tests and coverage floors
│   └── Dockerfile
├── docs/                    # test plan and test report
├── docker-compose.yml       # one-command local stack
└── .github/workflows/ci.yml # backend, frontend, docker and e2e jobs
```

### Backend request flow

```
HTTP ──▶ routers (validate with schemas, map errors to status codes)
            │
            ▼
         services (business rules, e.g. authenticate, place_order, change_status)
            │
            ▼
       repositories (SQL, return models)  ──▶  SQLite file
```

Routers never write SQL; repositories never raise `HTTPException`. Auth is a
dependency (`CurrentUser`, or `AdminUser` for admin-only routes) that any route
can require by adding a parameter. The order service owns its transactions so
stock changes and order rows land (or roll back) together.

### Frontend

Pages under `src/app` are thin: they load data through `useAuthedLoad` (which
asks `GET /auth/me` and sends a 401 to `/login`), call `src/lib/api.ts`, and
render components from `src/components`. Components and `lib/` are unit tested
with the router and API client mocked; pages are tested the same way. List →
detail navigation uses dedicated routes with breadcrumbs.

## Getting started

### With Docker (one command)

```bash
docker compose up --build
```

Then open <http://localhost:3000>. Both services are published on `127.0.0.1`
only: the stack uses the built-in development JWT key and the public seeded
passwords, so it is for local use. To change settings, copy
`backend/.env.example` to `backend/.env` (for example to set
`INVENTRA_SECRET_KEY`). Data lives in the `inventra-data` volume;
`docker compose down -v` wipes it. Requires Docker Compose 2.24+.

### Without Docker

Prerequisites: [uv](https://docs.astral.sh/uv/) (it downloads Python 3.12 for
you) and Node.js 22.22+ or 24.15+ with npm.

```bash
cd backend
uv sync                        # creates .venv with runtime + dev deps
uv run python -m app.seed      # creates inventra.db, admin/staff users, sample products
uv run uvicorn app.main:app --reload
```

API docs: <http://localhost:8000/docs>. Configuration is read from
`INVENTRA_*` environment variables (see `backend/.env.example`); defaults
work for local development.

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open <http://localhost:3000>. Use `localhost` (not `127.0.0.1`) for both the UI
and `NEXT_PUBLIC_API_URL`, so the session cookie is shared between them.

## Running the tests

Backend (from `backend/`): unit and API integration tests, with coverage
(fails under 90%):

```bash
uv run pytest --cov
uv run ruff check . && uv run ruff format --check .
```

Frontend (from `frontend/`): unit and component tests with coverage floors
(`vitest.config.mts`), lint and types:

```bash
npm run test:coverage
npm run test:watch                 # re-runs on save while you work
npm run lint && npm run typecheck
```

End-to-end (from `frontend/`): starts a seeded API on :8000 and the production
UI on :3000, so stop any dev servers on those ports first:

```bash
npx playwright install chromium    # once
npm run test:e2e
```

CI runs four jobs on pushes to `main` and on pull requests: backend (ruff + pytest +
coverage), frontend (eslint + tsc + vitest + coverage + `next build`), docker
(builds the compose stack and smoke tests it, including the browser → API path)
and e2e (Playwright). Coverage tables appear in the job summary and the HTML
reports are uploaded as artifacts.

## API overview

All routes except `/health`, `/auth/login` and `/auth/logout` need a session
(the `inventra_session` cookie, or `Authorization: Bearer <token>` for API
clients).

| Method | Path                         | Who    | Description                                                                   |
| ------ | ---------------------------- | ------ | ----------------------------------------------------------------------------- |
| GET    | `/health`                    | –      | Liveness check                                                                |
| POST   | `/auth/login`                | –      | `{username, password}` → sets the session cookie, returns `{access_token, token_type}`; 429 + `Retry-After` when throttled |
| POST   | `/auth/logout`               | –      | Clears the session cookie                                                     |
| GET    | `/auth/me`                   | any    | Current user `{id, username, role}`                                           |
| POST   | `/auth/password`             | any    | `{current_password, new_password}` → 204                                      |
| GET    | `/products`                  | any    | List; `?q=` search, `?below=` low stock, `?limit=&offset=` (`X-Total-Count`)   |
| POST   | `/products`                  | any    | Create (201; 409 on duplicate SKU)                                            |
| GET    | `/products/{id}`             | any    | Product by id (404 when missing)                                              |
| PATCH  | `/products/{id}`             | any    | Update `sku`, `name`, `price`                                                  |
| DELETE | `/products/{id}`             | admin  | 204; 409 if the product is on an order                                        |
| POST   | `/products/{id}/adjust`      | any    | `{change, reason}`; 409 if stock would go negative                            |
| GET    | `/products/{id}/movements`   | any    | Stock movement history                                                        |
| GET    | `/orders`                    | any    | Newest first; `?status=` filter                                                |
| POST   | `/orders`                    | any    | `{customer_name, items: [{product_id, quantity}]}`; 404 / 409 / 422           |
| GET    | `/orders/{id}`               | any    | Order with items and total                                                    |
| PATCH  | `/orders/{id}`               | any    | `{status}`: `pending → paid → shipped`, cancel before shipping                |
| GET    | `/users`                     | admin  | List users                                                                    |
| POST   | `/users`                     | admin  | `{username, password, role}`                                                  |
| PATCH  | `/users/{id}`                | admin  | `{role}` (not your own)                                                       |

## Security notes

- The session cookie is `HttpOnly; SameSite=Lax` (add `Secure` with
  `INVENTRA_COOKIE_SECURE=true` behind HTTPS). Cookie-authenticated writes must
  carry an `Origin` listed in `INVENTRA_CORS_ORIGINS`, which blocks cross-site
  request forgery; a wildcard origin is refused at startup.
- Failed logins are throttled per client address and username, with a budget
  per client address across usernames. Behind a reverse proxy, run uvicorn with
  `--forwarded-allow-ips=<proxy address>` so it sees real client addresses.
- Known limitations: logging out or changing a password does not revoke tokens
  already issued (they expire after `INVENTRA_TOKEN_TTL_MINUTES`); the throttle
  is in-process and does not cover `POST /auth/password`; the proxy only checks
  that the cookie exists (the API validates it), and relies on the UI and API
  sharing a host name.

## TDD workflow and commit conventions

This project is developed red → green → refactor, and the git history is
meant to show it. Each step is its own commit:

| Step     | Commit prefix                       | Rule                                                                   |
| -------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Red      | `test(scope): …`                    | Add a failing test. Run it; it must fail for the *right* reason.       |
| Green    | `feat(scope): …` / `fix(scope): …`  | The smallest change that makes the suite pass. Nothing speculative.    |
| Refactor | `refactor(scope): …`                | Improve structure with the suite still green. No behaviour change.     |

`scope` is `backend`, `frontend` or `e2e`. Other prefixes: `chore`, `docs`,
`ci`. Tests that pin down behaviour which already works (characterization
tests, end-to-end acceptance tests) are committed as `test(scope): cover …`
and say so. Example from the log:

```
test(backend): add failing tests for placing an order
feat(backend): add POST /orders that records items and takes them out of stock
refactor(backend): reuse record_movement in adjust_stock
```

Guidelines:

- One behaviour per red commit. If you need three tests, that is fine; if
  you need three features, that is three cycles.
- Never commit a red test together with its implementation, and never
  squash the red commit away when merging.
- Test at the boundary that matters: HTTP tests for routers (via
  `TestClient`), direct tests for repositories/services, component tests for
  the UI, Playwright for whole user flows. Mock only what you do not own
  (`fetch`, `next/navigation`).
- When a test is meant to guard a rule, mutation-check it: break the rule on
  purpose and make sure a test fails.
- Keep fixtures in `backend/tests/conftest.py` (`client`, `db`, `user`,
  `auth_headers`, `staff`, `staff_headers`) and `frontend/vitest.setup.ts`.

## Roadmap

Everything from the original roadmap is done: orders, inventory, product
update/delete/search/pagination, roles and user management, login hardening,
the orders and inventory UI, product forms, httpOnly cookie sessions with a
route guard, Playwright end-to-end tests, Docker and coverage reports in CI.

Possible next steps:

- Revoke tokens on logout and password change (a token version per user).
- Pagination in the UI and for `GET /orders`.
- A shared store for the login throttle if the API ever runs as several instances.

## Contributing

1. Branch from `main`: `feat/…`, `fix/…`, `test/…`, `docs/…`.
2. Work in red/green/refactor commits as described above.
3. Open a pull request; CI must be green. In the description, list the
   cycles (which tests were added, what they drove).
4. Review, then merge with a merge commit (no squash) so the cycle history
   survives.
