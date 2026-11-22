import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createOrder,
  fetchOrder,
  fetchOrders,
  updateOrderStatus,
  type Order,
} from "@/lib/api";

const order: Order = {
  id: 7,
  customer_name: "ACME Corp",
  status: "pending",
  created_by: 1,
  created_at: "2026-11-22 10:00:00",
  items: [
    { product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 2, unit_price: 89, line_total: 178 },
  ],
  total: 178,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOrders", () => {
  it("lists orders with the bearer token", async () => {
    const fetchMock = stubFetch(jsonResponse([order]));

    expect(await fetchOrders("tok")).toEqual([order]);

    const { url, headers } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/orders");
    expect(headers.get("authorization")).toBe("Bearer tok");
  });

  it("filters by status", async () => {
    const fetchMock = stubFetch(jsonResponse([]));

    await fetchOrders("tok", "paid");

    expect(lastCall(fetchMock).url).toBe("http://localhost:8000/orders?status=paid");
  });
});

describe("fetchOrder", () => {
  it("fetches one order by id", async () => {
    const fetchMock = stubFetch(jsonResponse(order));

    expect(await fetchOrder("tok", 7)).toEqual(order);
    expect(lastCall(fetchMock).url).toBe("http://localhost:8000/orders/7");
  });

  it("throws an ApiError with status 404 for a missing order", async () => {
    stubFetch(jsonResponse({ detail: "Order not found" }, 404));

    await expect(fetchOrder("tok", 99)).rejects.toMatchObject({ status: 404, message: "Order not found" });
    await expect(fetchOrder("tok", 99)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createOrder", () => {
  it("posts the customer and items", async () => {
    const fetchMock = stubFetch(jsonResponse(order, 201));
    const input = { customer_name: "ACME Corp", items: [{ product_id: 1, quantity: 2 }] };

    expect(await createOrder("tok", input)).toEqual(order);

    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/orders");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(input));
    expect(headers.get("authorization")).toBe("Bearer tok");
  });

  it("surfaces the backend's stock error", async () => {
    stubFetch(jsonResponse({ detail: "Insufficient stock for KB-001" }, 409));

    await expect(
      createOrder("tok", { customer_name: "ACME", items: [{ product_id: 1, quantity: 99 }] }),
    ).rejects.toMatchObject({ status: 409, message: "Insufficient stock for KB-001" });
  });
});

describe("updateOrderStatus", () => {
  it("patches the order's status", async () => {
    const fetchMock = stubFetch(jsonResponse({ ...order, status: "paid" }));

    expect((await updateOrderStatus("tok", 7, "paid")).status).toBe("paid");

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/orders/7");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ status: "paid" }));
  });
});
