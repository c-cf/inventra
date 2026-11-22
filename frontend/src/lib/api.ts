export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type TokenResponse = { access_token: string; token_type: string };

export type User = { id: number; username: string; role: string };

export type Product = {
  id: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  created_at: string;
};

export type StockMovement = {
  id: number;
  product_id: number;
  change: number;
  reason: string;
  created_at: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

/** Single place that talks to the backend: builds headers, raises ApiError on non-2xx. */
async function request<T>(path: string, { method = "GET", body, token }: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await errorDetail(response));
  }
  return response.json() as Promise<T>;
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((item: { loc: unknown[]; msg: string }) => `${item.loc.at(-1)}: ${item.msg}`)
        .join("; ");
    }
  } catch {
    // non-JSON error body; fall through to the generic message
  }
  return `Request failed with status ${response.status}`;
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>("/auth/login", { method: "POST", body: { username, password } });
}

export function fetchMe(token: string): Promise<User> {
  return request<User>("/auth/me", { token });
}

export function fetchProducts(token: string, below?: number): Promise<Product[]> {
  const query = below === undefined ? "" : `?below=${encodeURIComponent(below)}`;
  return request<Product[]>(`/products${query}`, { token });
}

export type ProductInput = {
  sku: string;
  name: string;
  price: number;
  quantity: number;
};

export function createProduct(token: string, input: ProductInput): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: input, token });
}

export function adjustStock(
  token: string,
  productId: number,
  change: number,
  reason: string,
): Promise<Product> {
  return request<Product>(`/products/${productId}/adjust`, {
    method: "POST",
    token,
    body: { change, reason },
  });
}

export function fetchStockMovements(
  token: string,
  productId: number,
): Promise<StockMovement[]> {
  return request<StockMovement[]>(
    `/products/${productId}/movements`,
    { token },
  );
}
export const ORDER_STATUSES = ["pending", "paid", "shipped", "cancelled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItem = {
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Order = {
  id: number;
  customer_name: string;
  status: OrderStatus;
  created_by: number;
  created_at: string;
  items: OrderItem[];
  total: number;
};

export type OrderInput = {
  customer_name: string;
  items: { product_id: number; quantity: number }[];
};

export function fetchOrders(token: string, status?: OrderStatus): Promise<Order[]> {
  const query = status === undefined ? "" : `?status=${encodeURIComponent(status)}`;
  return request<Order[]>(`/orders${query}`, { token });
}

export function fetchOrder(token: string, orderId: number): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, { token });
}

export function createOrder(token: string, input: OrderInput): Promise<Order> {
  return request<Order>("/orders", { method: "POST", body: input, token });
}

export function updateOrderStatus(
  token: string,
  orderId: number,
  status: OrderStatus,
): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, { method: "PATCH", body: { status }, token });
}
