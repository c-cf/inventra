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
};

/**
 * Single place that talks to the backend: raises ApiError on non-2xx.
 * The session lives in an httpOnly cookie set by the API, so scripts never see a
 * token; `credentials: "include"` makes the browser send (and accept) that cookie.
 */
async function request<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await errorDetail(response));
  }
  if (response.status === 204) return undefined as T;
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

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function fetchMe(): Promise<User> {
  return request<User>("/auth/me");
}

export type ProductQuery = { below?: number; q?: string };

export function fetchProducts(query: ProductQuery = {}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (query.below !== undefined) params.set("below", String(query.below));
  const search = query.q?.trim();
  if (search) params.set("q", search);
  const queryString = params.toString();
  return request<Product[]>(`/products${queryString ? `?${queryString}` : ""}`);
}

export type ProductInput = {
  sku: string;
  name: string;
  price: number;
  quantity: number;
};

export function createProduct(input: ProductInput): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: input });
}

export function fetchProduct(productId: number): Promise<Product> {
  return request<Product>(`/products/${productId}`);
}

export type ProductUpdate = Partial<Pick<Product, "sku" | "name" | "price">>;

export function updateProduct(productId: number, changes: ProductUpdate): Promise<Product> {
  return request<Product>(`/products/${productId}`, { method: "PATCH", body: changes });
}

export function deleteProduct(productId: number): Promise<void> {
  return request<void>(`/products/${productId}`, { method: "DELETE" });
}

export function adjustStock(productId: number, change: number, reason: string): Promise<Product> {
  return request<Product>(`/products/${productId}/adjust`, {
    method: "POST",
    body: { change, reason },
  });
}

export function fetchStockMovements(productId: number): Promise<StockMovement[]> {
  return request<StockMovement[]>(`/products/${productId}/movements`);
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

export function fetchOrders(status?: OrderStatus): Promise<Order[]> {
  const query = status === undefined ? "" : `?status=${encodeURIComponent(status)}`;
  return request<Order[]>(`/orders${query}`);
}

export function fetchOrder(orderId: number): Promise<Order> {
  return request<Order>(`/orders/${orderId}`);
}

export function createOrder(input: OrderInput): Promise<Order> {
  return request<Order>("/orders", { method: "POST", body: input });
}

export function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, { method: "PATCH", body: { status } });
}

export const ROLES = ["admin", "staff"] as const;

export type Role = (typeof ROLES)[number];

export type UserSummary = { id: number; username: string; role: Role; created_at: string };

export type UserInput = { username: string; password: string; role: Role };

export function fetchUsers(): Promise<UserSummary[]> {
  return request<UserSummary[]>("/users");
}

export function createUser(input: UserInput): Promise<UserSummary> {
  return request<UserSummary>("/users", { method: "POST", body: input });
}

export function updateUserRole(userId: number, role: Role): Promise<UserSummary> {
  return request<UserSummary>(`/users/${userId}`, { method: "PATCH", body: { role } });
}

export function changePassword(currentPassword: string,
  newPassword: string,
): Promise<void> {
  return request<void>("/auth/password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
