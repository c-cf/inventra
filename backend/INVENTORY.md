# Inventory Module

## Overview

The Inventory module provides product management, stock adjustment, low-stock filtering, and stock movement history using FastAPI and SQLite.

## Implemented Features

- Create and retrieve products.
- List all products.
- Filter products with low stock.
- Increase or decrease product quantities.
- Prevent stock quantities from becoming negative.
- Validate stock adjustment inputs.
- Record successful stock adjustments.
- Retrieve stock movement history.
- Ensure failed adjustments do not create movement records.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/products` | Create a product |
| GET | `/products` | List all products |
| GET | `/products/{product_id}` | Get product details |
| GET | `/products?below=5` | Filter products with quantity below 5 |
| POST | `/products/{product_id}/adjust` | Adjust stock quantity |
| GET | `/products/{product_id}/movements` | Retrieve stock movement history |

These endpoints require authentication.

## Stock Adjustment Example

Request:

```http
POST /products/3/adjust
```

```json
{
  "change": 5,
  "reason": "restock"
}
```

A positive change increases stock, while a negative change decreases stock.

## Error Handling

- `404 Not Found`: Product does not exist.
- `409 Conflict`: Insufficient stock.
- `422 Unprocessable Entity`: Invalid adjustment input.

## Testing

The Inventory module was developed using Test-Driven Development (TDD), following Red-Green cycles.

Tests cover stock increases, decreases, insufficient stock, invalid input, movement history, failed adjustments, and low-stock filtering.

Run Inventory tests:

```bash
cd backend
uv run pytest tests/test_inventory.py -v
```

Run all backend tests:

```bash
uv run pytest -v
```

## Manual Verification

The backend was manually tested using FastAPI Swagger UI and SQLite.

Verified operations include:

- Product retrieval.
- Low-stock filtering.
- Successful stock adjustment.
- Persistent stock movement records.

## Development Status

- Backend Inventory API: Completed.
- Automated backend tests: Completed.
- Frontend Inventory integration: Pending.

## Next Steps

Integrate Inventory features into the existing Next.js product page, including low-stock filtering, stock adjustment, and movement history.