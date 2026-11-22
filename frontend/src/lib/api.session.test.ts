import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMe, fetchProducts, login, logout } from "@/lib/api";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cookie session", () => {
  it.each([
    ["login", () => login("alice", "secret123")],
    ["fetchMe", () => fetchMe()],
    ["fetchProducts", () => fetchProducts()],
  ])("%s sends the session cookie and no Authorization header", async (_name, call) => {
    const fetchMock = vi.fn().mockResolvedValue(json({ access_token: "x", token_type: "bearer" }));
    vi.stubGlobal("fetch", fetchMock);

    await call();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("logs out through the API, which clears the httpOnly cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/auth/logout");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });
});
