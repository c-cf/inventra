import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  adjustStock,
  createProduct,
  fetchMe,
  fetchProducts,
  fetchStockMovements,
  login,
} from "@/lib/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("posts credentials to /auth/login and returns the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: "tok", token_type: "bearer" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await login("alice", "secret123");

    expect(result).toEqual({ access_token: "tok", token_type: "bearer" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/auth/login");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ username: "alice", password: "secret123" }));
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("throws an ApiError carrying the server's detail message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Invalid username or password" }, 401)),
    );

    const promise = login("alice", "wrong");

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 401,
      message: "Invalid username or password",
    });
  });
});

describe("fetchProducts", () => {
  it("returns the product list", async () => {
    const products = [
      { id: 1, sku: "KB-001", name: "Keyboard", price: 89, quantity: 25, created_at: "2026-01-01" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(products));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProducts();

    expect(result).toEqual(products);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/products");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("throws an ApiError with status 401 when the token is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Not authenticated" }, 401)),
    );

    await expect(fetchProducts()).rejects.toMatchObject({ status: 401 });
  });

  it("filters products using the below query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchProducts({ below: 5 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:8000/products?below=5");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });
});

describe("createProduct", () => {
  it("posts the product and returns the created product", async () => {
    const created = { id: 7, sku: "MS-002", name: "Mouse", price: 25, quantity: 10, created_at: "2026-11-09" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);

    const input = { sku: "MS-002", name: "Mouse", price: 25, quantity: 10 };
    const result = await createProduct(input);

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/products");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(input));
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("turns FastAPI validation errors into a readable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            detail: [
              { loc: ["body", "price"], msg: "Input should be greater than or equal to 0", type: "greater_than_equal" },
              { loc: ["body", "sku"], msg: "String should have at least 1 character", type: "string_too_short" },
            ],
          },
          422,
        ),
      ),
    );

    const promise = createProduct({ sku: "", name: "Mouse", price: -1, quantity: 0 });

    await expect(promise).rejects.toMatchObject({
      status: 422,
      message: "price: Input should be greater than or equal to 0; sku: String should have at least 1 character",
    });
  });
});

describe("adjustStock", () => {
  it("sends a stock adjustment with a reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 3,
        sku: "SKU-003",
        name: "Keyboard",
        price: 100,
        quantity: 13,
        created_at: "2026-11-21T00:00:00",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await adjustStock(3, 5, "restock");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:8000/products/3/adjust");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    expect(JSON.parse(init.body as string)).toEqual({
      change: 5,
      reason: "restock",
    });
  });

  it("supports decreasing stock", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 3, quantity: 6 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await adjustStock(3, -2, "sold");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(JSON.parse(init.body as string)).toEqual({
      change: -2,
      reason: "sold",
    });
  });
});

describe("fetchStockMovements", () => {
  it("fetches stock movement history for a product", async () => {
    const movements = [
      {
        id: 1,
        product_id: 3,
        change: 5,
        reason: "restock",
        created_at: "2026-11-21T10:00:00",
      },
      {
        id: 2,
        product_id: 3,
        change: -2,
        reason: "sold",
        created_at: "2026-11-21T11:00:00",
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(movements),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStockMovements(3);

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe(
      "http://localhost:8000/products/3/movements",
    );
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    expect(result).toEqual(movements);
  });

  it("returns an empty array when there are no movements", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStockMovements(3);

    expect(result).toEqual([]);
  });
});

describe("fetchMe", () => {
  it("returns the current user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, username: "alice", role: "admin" }));
    vi.stubGlobal("fetch", fetchMock);

    const user = await fetchMe();

    expect(user).toEqual({ id: 1, username: "alice", role: "admin" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/auth/me");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });
});

describe("error responses", () => {
  it("falls back to a generic message when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 })),
    );

    await expect(fetchMe()).rejects.toMatchObject({
      status: 502,
      message: "Request failed with status 502",
    });
  });

  it("falls back to a generic message when the JSON body has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500)));

    await expect(fetchMe()).rejects.toMatchObject({
      status: 500,
      message: "Request failed with status 500",
    });
  });
});
