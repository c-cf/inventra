import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderDetail } from "@/components/OrderDetail";
import { ApiError, fetchMe, fetchOrder, updateOrderStatus, type Order } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const params = vi.hoisted(() => ({ current: { id: "7" } as Record<string, string> }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => params.current,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

const order: Order = {
  id: 7,
  customer_name: "ACME Corp",
  status: "pending",
  created_by: 1,
  created_at: "2026-11-22 10:00:00",
  items: [
    { product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 2, unit_price: 89, line_total: 178 },
    { product_id: 2, sku: "MS-001", name: "Mouse", quantity: 1, unit_price: 25.5, line_total: 25.5 },
  ],
  total: 203.5,
};

beforeEach(() => {
  window.localStorage.clear();
  params.current = { id: "7" };
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchOrder).mockReset().mockResolvedValue(order);
  vi.mocked(updateOrderStatus).mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderDetail", () => {
  it("redirects to /login when no token is stored", () => {
    render(<OrderDetail />);

    expect(router.replace).toHaveBeenCalledWith("/login");
  });

  it("shows a breadcrumb back to the orders list", async () => {
    setToken("tok");

    render(<OrderDetail />);

    const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/orders");
    expect(within(breadcrumb).getByText("Order #7")).toHaveAttribute("aria-current", "page");
    expect(fetchOrder).toHaveBeenCalledWith("tok", 7);
  });

  it("shows the customer, status, lines and total", async () => {
    setToken("tok");

    render(<OrderDetail />);

    expect(await screen.findByText("ACME Corp")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(within(rows[1]).getByText("KB-001")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$89.00")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$178.00")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("$203.50")).toBeInTheDocument();
  });

  it("updates the page after a status change", async () => {
    setToken("tok");
    vi.mocked(updateOrderStatus).mockResolvedValue({ ...order, status: "paid" });
    render(<OrderDetail />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Mark as paid" }));

    expect(await screen.findByText("paid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as shipped" })).toBeInTheDocument();
  });

  it("says when the order does not exist and links back", async () => {
    setToken("tok");
    vi.mocked(fetchOrder).mockRejectedValue(new ApiError(404, "Order not found"));

    render(<OrderDetail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Order not found");
    expect(screen.getByRole("link", { name: "Back to orders" })).toHaveAttribute("href", "/orders");
  });

  it("does not ask the API for an id that is not a number", async () => {
    setToken("tok");
    params.current = { id: "abc" };

    render(<OrderDetail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Order not found");
    expect(fetchOrder).not.toHaveBeenCalled();
  });

  it("signs the user out when a status change is rejected with 401", async () => {
    setToken("tok");
    vi.mocked(updateOrderStatus).mockRejectedValue(new ApiError(401, "Not authenticated"));
    render(<OrderDetail />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Mark as paid" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(getToken()).toBeNull();
  });

  it("signs out an expired session even when the id is not a number", async () => {
    setToken("expired");
    params.current = { id: "abc" };
    // The session check takes a round trip; the malformed id is rejected at once.
    vi.mocked(fetchMe).mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new ApiError(401, "Not authenticated")), 10),
        ),
    );

    render(<OrderDetail />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(getToken()).toBeNull();
  });
});
