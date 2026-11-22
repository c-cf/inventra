import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewOrderPage from "@/app/orders/new/page";
import { ApiError, createOrder, fetchMe, fetchProducts, type Order } from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  createOrder: vi.fn(),
}));

const keyboard = { id: 1, sku: "KB-001", name: "Keyboard", price: 89, quantity: 10, created_at: "x" };

const created: Order = {
  id: 7,
  customer_name: "ACME Corp",
  status: "pending",
  created_by: 1,
  created_at: "2026-11-22 10:00:00",
  items: [{ product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 2, unit_price: 89, line_total: 178 }],
  total: 178,
};

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchProducts).mockReset().mockResolvedValue([keyboard]);
  vi.mocked(createOrder).mockReset();
});

async function placeOrder() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Customer"), "ACME Corp");
  await user.selectOptions(screen.getByLabelText("Product 1"), "1");
  await user.clear(screen.getByLabelText("Quantity 1"));
  await user.type(screen.getByLabelText("Quantity 1"), "2");
  await user.click(screen.getByRole("button", { name: "Place order" }));
}

describe("NewOrderPage", () => {
  it("redirects to /login when there is no session", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError(401, "Not authenticated"));

    render(<NewOrderPage />);

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("shows a breadcrumb back to the orders list", async () => {

    render(<NewOrderPage />);

    const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/orders");
    expect(within(breadcrumb).getByText("New order")).toHaveAttribute("aria-current", "page");
  });

  it("goes to the new order's page after placing it", async () => {
    vi.mocked(createOrder).mockResolvedValue(created);
    render(<NewOrderPage />);

    await placeOrder();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/orders/7"));
    expect(fetchProducts).toHaveBeenCalledWith();
  });

  it("signs the user out when placing the order is rejected with 401", async () => {
    vi.mocked(createOrder).mockRejectedValue(new ApiError(401, "Not authenticated"));
    render(<NewOrderPage />);

    await placeOrder();

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("shows an error when the products cannot be loaded", async () => {
    vi.mocked(fetchProducts).mockRejectedValue(new ApiError(500, "Database unavailable"));

    render(<NewOrderPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });
});
