import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchProducts, login } from "@/lib/api";

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
});
