# Inventra test plan

## 1. Purpose and scope

This plan describes how Inventra — an order and inventory management web
application — is tested: which levels of testing exist, which techniques were
used to design the test cases, what "done" means, and where each requirement is
covered. Results are in the [test report](TEST_REPORT.md).

In scope: the FastAPI backend (`backend/`), the Next.js frontend (`frontend/`),
the Docker Compose stack, and the CI pipeline. Out of scope: load and
performance testing, cross-browser testing beyond Chromium, and deployment to a
hosted environment.

## 2. Features under test

| ID  | Feature                                                        | Main code                                                        |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| F1  | Sign-in, sign-out, session cookie, route guard                 | `routers/auth.py`, `deps.py`, `src/proxy.ts`, `useAuthedLoad`    |
| F2  | Login hardening: uniform timing, failed-login throttle         | `services/auth.py`, `login_throttle.py`                          |
| F3  | Roles and user management, password change                     | `routers/users.py`, `/users`, `/account`                         |
| F4  | Products: create, list, search, paginate, edit, delete         | `routers/products.py`, `repositories/products.py`, product pages |
| F5  | Inventory: stock adjustments, movement history, low-stock filter | `adjust_stock`, `StockAdjustmentForm`, `StockMovementHistory`    |
| F6  | Orders: place, list, filter, status changes, cancel restocks   | `services/orders.py`, `routers/orders.py`, order pages           |
| F7  | Input validation and robustness (bounds, malformed input)      | `schemas/*`, `errors.py`, client-side validation                 |
| F8  | Packaging: Docker Compose stack                                | `Dockerfile`s, `docker-compose.yml`                              |

## 3. Test levels and tools

| Level                  | What it exercises                                          | Tool                                   | Where                                   |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------- | --------------------------------------- |
| Unit (backend)         | Repositories, services, the throttle, security helpers     | pytest                                 | `backend/tests/test_*_repository.py`, `test_orders_service.py`, `test_login_throttle_unit.py`, `test_security.py`, `test_config.py` |
| API integration        | Each endpoint through HTTP, with a real SQLite file per test | pytest + Starlette `TestClient`        | `backend/tests/test_*.py`               |
| Unit (frontend)        | API client, validation helpers, the route guard            | Vitest                                 | `frontend/src/lib/*.test.ts`, `src/proxy.test.ts` |
| Component / page       | Forms, tables, pages with the API client and router mocked | Vitest + React Testing Library + user-event (jsdom) | `frontend/src/**/*.test.tsx` |
| End-to-end             | Whole user flows in a real browser against the real API    | Playwright (Chromium)                  | `frontend/e2e/*.spec.ts`                |
| Smoke (system)         | The built images start healthy; the API serves a seeded login, CORS admits the UI's origin, the UI bundle targets the API | `docker compose` + curl in CI | `.github/workflows/ci.yml` (`docker`) |
| Static checks          | Lint, formatting, types                                    | ruff, ESLint, `tsc`                    | CI `backend` / `frontend` jobs          |

Every backend test gets a fresh temporary database (`db_path` fixture), so tests
are independent. End-to-end tests share one seeded database and therefore
create uniquely named data in every test; the suite passes when repeated
(`--repeat-each=3`).

## 4. Development process: test-driven development

Features are built red → green → refactor, with one commit per step
(`test(scope): …` that fails for the right reason, then `feat`/`fix`, then
`refactor`). The git history is part of the evidence: every red commit can be
checked out and shown to fail. Tests that pin down behaviour which already
worked are labelled `test(scope): cover …`.

Pull requests #2–#9 were reviewed by a teammate on GitHub. From #10 on, review
was done instead by an independent reviewer (a separate agent with no access to
the author's reasoning) that re-ran the suite, replayed red commits, and tried
to break the code; the author merged once it reported no open P0/P1. Findings were rated P0–P3 (see §9); nothing was merged
with an open P0 or P1. The few places where the history departs from strict
red → green are listed in the test report (§5).

## 5. Test design techniques

**Equivalence partitioning and boundary values.** Inputs are split into valid
and invalid classes and tested at their edges:

| Input                          | Valid boundary tested             | Invalid boundary tested          | Tests |
| ------------------------------ | --------------------------------- | -------------------------------- | ----- |
| New password                   | 8 characters; exactly 72 bytes    | 7 characters; 73 bytes; 4 emoji (8 UTF-16 units, 4 characters) | `test_users.py`, `passwords.test.ts` |
| Username                       | 3 and 150 characters              | 2, 151, a space                  | `test_users.py`, `UserCreateForm.test.tsx` |
| Order line quantity            | 1                                 | 0, -1, 1.5, 10^20                | `test_orders.py`, `OrderForm.test.tsx` |
| Ids in paths and bodies        | ids returned by the API           | 10^20 (overflows SQLite)         | `test_orders.py`, `test_products_query.py`, `test_users.py` |
| Low-stock threshold            | quantity == threshold is *not* low | negative, fractional, blank      | `page.inventory.test.tsx`, `test_inventory.py` |
| Product price                  | typical prices with cents (9.99, 12.5) | -1, 2,000,000,000, infinity (`1e309`); client: above 1,000,000,000 | `test_products.py`, `test_products_query.py`, `ProductEditForm.test.tsx` |
| Search text                    | `%`, `_`, `!` matched literally; non-ASCII names; blank or whitespace means no filter | (the 100-character limit is enforced by the schema but not tested) | `test_products_query.py` |

**State transition testing.** Orders follow this model; every valid edge and
the invalid ones below are tested (`test_orders.py`,
`OrderStatusActions.test.tsx`, `e2e/orders.spec.ts`):

```
pending ──paid──▶ paid ──shipped──▶ shipped
   │                 │
   └──cancelled──────┴──cancelled──▶ cancelled   (stock is restored)
```

Invalid transitions tested (409): pending → shipped, pending → pending,
paid → pending, paid → paid, shipped → paid, shipped → cancelled,
cancelled → paid, cancelled → cancelled.

**Decision table (authorization).** Role × action, tested with the `staff` and
admin fixtures (`test_users.py`, `test_staff_access.py`) and in the UI
(`AppHeader.test.tsx`, `ProductDetail.test.tsx`, `e2e/roles.spec.ts`). The
signed-out column is tested on representative endpoints of each router (list,
create and update products, orders, users, `/auth/me`, `/auth/password`), not
on every route:

| Action                                   | Signed out | Staff | Admin |
| ---------------------------------------- | ---------- | ----- | ----- |
| Read/create/update products, adjust stock, orders | 401 | ✔ | ✔ |
| Delete a product                         | 401        | 403   | ✔     |
| List/create users, change another user's role | 401   | 403   | ✔     |
| Change a role (own or another's)         | 401        | 403   | 409 for own, ✔ for others |
| Change own password                      | 401        | ✔     | ✔     |

**Negative testing and error guessing.** Null fields on update, duplicate
SKUs/usernames, unknown products in orders, LIKE wildcards in search, oversized
integers and infinite floats, a 72+ byte password reaching bcrypt, non-numeric
route ids, cross-site requests with the session cookie, a wildcard CORS origin.

**Concurrency and timing.** Order status uses compare-and-set (a stale read
cannot cancel twice — `test_orders_service.py`); login attempts are counted
before bcrypt so parallel guesses are capped (`test_login_throttle_unit.py`);
the UI drops stale responses, blocks double submits and disables filters while
a request is in flight (component tests with deferred promises).

**Atomicity.** A failed order or cancellation leaves no partial rows, checked on
a reused connection that commits unrelated work afterwards
(`test_orders_service.py`).

**Mutation checking.** For rules that matter, the test was validated by
breaking the code on purpose (e.g. removing a rollback, an `ESCAPE` clause, a
role check, the CSRF Origin check, the stock restore on cancel) and confirming a
test fails. Surviving mutants found in review were turned into new tests.

## 6. Entry and exit criteria

**Entry**: a change enters review when its branch is up to date with `main`,
its PR description lists the red → green cycles, and the author has run the
affected suites locally.

**Exit**: a change may be merged when:

- all CI jobs pass: backend (ruff, pytest), frontend (ESLint, `tsc`, Vitest,
  `next build`), docker smoke test, Playwright e2e;
- coverage stays above the floors enforced in CI — backend **90%** (statements
  and branches, `pyproject.toml`), frontend **90 / 85 / 90 / 90**
  (statements / branches / functions / lines, `vitest.config.mts`);
- the TDD history shows a failing test before each behaviour change;
- the independent review reports no open P0 or P1.

## 7. Roles, schedule and deliverables

| Role | Responsibility |
| ---- | -------------- |
| Developers (three team members, see the git history) | Write the failing test first, implement, refactor; keep CI green |
| Reviewer (a teammate for #2–#9; a separate agent from #10 on) | Re-run suites, replay red commits, mutation-check, rate findings P0–P3 |
| CI (GitHub Actions) | Enforce lint, types, tests, coverage floors, the Docker smoke test and E2E on every PR |

| Phase | Dates (2026) | Work |
| ----- | ------------ | ---- |
| Foundation | Nov 5–9 | Scaffold, auth, products API and UI, CI; product form started |
| Products and inventory | Nov 16–21 | Product form merged, inventory API and UI, product update |
| Completion | Nov 22–23 | Coverage in CI, orders, search and delete, roles, login hardening, cookie sessions, Docker, E2E, documentation |

Deliverables: the source code and test suites in this repository, the CI
workflow, this test plan, the [test report](TEST_REPORT.md), and the review
history in the pull requests.

## 8. Environments

| Environment | How                                         | Data                                   |
| ----------- | ------------------------------------------- | -------------------------------------- |
| Local       | `uv run pytest`, `npm run test:coverage`, `npm run test:e2e` | temp SQLite per test; seeded temp DB for e2e |
| CI          | GitHub Actions, `ubuntu-latest`, Node 24, Python 3.12 | same as local                    |
| Docker      | `docker compose up --build`                 | seeded SQLite in the `inventra-data` volume |

## 9. Defect management

Defects are tracked as GitHub issues or as review findings on the pull request,
with a severity:

| Severity | Meaning                                                                 | Merge? |
| -------- | ----------------------------------------------------------------------- | ------ |
| P0       | Breaks `main`/CI, data loss, or a security hole                         | No     |
| P1       | Functional bug, contract mismatch, or a test that doesn't test what it claims | No |
| P2       | Should be fixed, not blocking                                           | Yes, usually fixed first |
| P3       | Nit                                                                     | Yes    |

Every fix for a behavioural defect starts with a failing test that reproduces it.

## 10. Traceability

| Feature | Backend tests | Frontend tests | End-to-end |
| ------- | ------------- | -------------- | ---------- |
| F1 | `test_auth.py`, `test_cookie_auth.py`, `test_security.py`, `test_cors.py`, `test_health.py` | `api.session.test.ts`, `api.test.ts`, `proxy.test.ts`, `LoginForm.test.tsx`, `login/page.test.tsx`, `AppHeader.test.tsx`, page redirect tests | `auth.spec.ts` |
| F2 | `test_auth_service.py`, `test_login_throttle.py`, `test_login_throttle_unit.py`, `test_config.py` | — | — |
| F3 | `test_users.py`, `test_users_repository.py`, `test_password_change.py`, `test_staff_access.py`, `test_seed.py`, `test_case_insensitive.py`, `test_existing_database.py` | `UserCreateForm`, `UserTable`, `ChangePasswordForm`, `users/page`, `account/page`, `passwords.test.ts`, `api.users.test.ts` | `roles.spec.ts` |
| F4 | `test_products.py`, `test_products_query.py`, `test_products_repository.py`, `test_case_insensitive.py`, `test_existing_database.py` | `ProductForm`, `ProductTable`, `ProductEditForm`, `ProductDetail`, `products/page.test.tsx`, `page.search.test.tsx`, `page.activity.test.tsx`, `products/[id]/page.test.tsx`, `api.products.test.ts` | `products.spec.ts`, `inventory.spec.ts` |
| F5 | `test_inventory.py` | `StockAdjustmentForm`, `StockMovementHistory`, `page.inventory.test.tsx` | `inventory.spec.ts` |
| F6 | `test_orders.py`, `test_orders_service.py` | `OrderForm`, `OrderTable`, `OrderStatusActions`, `OrderDetail`, `orders/*page.test.tsx`, `api.orders.test.ts` | `orders.spec.ts`, `roles.spec.ts` |
| F7 | out-of-range and validation tests in each module | form validation tests | — |
| F8 | — | — | CI `docker` job |

## 11. Risks and mitigations

| Risk                                                      | Mitigation                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| UI tests pass against mocks that drift from the real API  | Contract checks in review; Playwright runs the real stack     |
| Flaky end-to-end tests from shared state                  | One worker, unique data per test, role locators, `--repeat-each` |
| Coverage numbers hide weak assertions                     | Mutation checks on key rules; reviews look for surviving mutants |
| Next.js keeps previous routes mounted but hidden          | E2E tests use role locators or `filter({ visible: true })`; unit tests hide and show the page in `<Activity>` (such as `*.activity.test.tsx`) |
