import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteProduct, fetchProducts, updateProduct, type Product } from "@/lib/api";

const keyboard: Product = {
  id: 1,
  sku: "KB-001",
  name: "Mechanical Keyboard",
  price: 89,
  quantity: 25,
  created_at: "2026-01-01",
};

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchProducts search", () => {
  it("sends the search text with the low-stock threshold", async () => {
    const fetchMock = stubFetch(json([]));

    await fetchProducts("tok", { q: "usb hub", below: 5 });

    expect(lastCall(fetchMock).url).toBe("http://localhost:8000/products?below=5&q=usb+hub");
  });

  it("leaves out blank search text", async () => {
    const fetchMock = stubFetch(json([]));

    await fetchProducts("tok", { q: "   " });

    expect(lastCall(fetchMock).url).toBe("http://localhost:8000/products");
  });
});

describe("updateProduct", () => {
  it("patches the given fields", async () => {
    const fetchMock = stubFetch(json({ ...keyboard, name: "Keyboard" }));

    const updated = await updateProduct("tok", 1, { name: "Keyboard", price: 79 });

    expect(updated.name).toBe("Keyboard");
    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/products/1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ name: "Keyboard", price: 79 }));
    expect(headers.get("authorization")).toBe("Bearer tok");
  });

  it("surfaces a duplicate SKU", async () => {
    stubFetch(json({ detail: "SKU already exists" }, 409));

    await expect(updateProduct("tok", 1, { sku: "MS-001" })).rejects.toMatchObject({
      status: 409,
      message: "SKU already exists",
    });
  });
});

describe("deleteProduct", () => {
  it("sends DELETE and accepts an empty 204 response", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteProduct("tok", 1)).resolves.toBeUndefined();

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/products/1");
    expect(init.method).toBe("DELETE");
  });

  it("surfaces the reason a product cannot be deleted", async () => {
    stubFetch(json({ detail: "Product has orders and cannot be deleted" }, 409));

    await expect(deleteProduct("tok", 1)).rejects.toMatchObject({
      status: 409,
      message: "Product has orders and cannot be deleted",
    });
  });
});
