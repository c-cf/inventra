import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createProduct, fetchProducts, login, adjustStock } from "@/lib/api";

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
  it("sends the bearer token and returns the product list", async () => {
    const products = [
      { id: 1, sku: "KB-001", name: "Keyboard", price: 89, quantity: 25, created_at: "2026-01-01" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(products));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProducts("tok");

    expect(result).toEqual(products);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/products");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
  });

  it("throws an ApiError with status 401 when the token is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Not authenticated" }, 401)),
    );

    await expect(fetchProducts("expired")).rejects.toMatchObject({ status: 401 });
  });

  it("filters products using the below query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchProducts("tok", 5);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:8000/products?below=5");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
  });
});

describe("createProduct", () => {
  it("posts the product with the bearer token and returns the created product", async () => {
    const created = { id: 7, sku: "MS-002", name: "Mouse", price: 25, quantity: 10, created_at: "2026-11-09" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);

    const input = { sku: "MS-002", name: "Mouse", price: 25, quantity: 10 };
    const result = await createProduct("tok", input);

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/products");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(input));
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
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

    const promise = createProduct("tok", { sku: "", name: "Mouse", price: -1, quantity: 0 });

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

    await adjustStock("tok", 3, 5, "restock");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:8000/products/3/adjust");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
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

    await adjustStock("tok", 3, -2, "sold");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(JSON.parse(init.body as string)).toEqual({
      change: -2,
      reason: "sold",
    });
  });
});