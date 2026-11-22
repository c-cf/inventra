import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrdersPage from "@/app/orders/page";
import { ApiError, fetchMe, fetchOrders, type Order } from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchOrders: vi.fn(),
}));

const alice = { id: 1, username: "alice", role: "admin" };

function order(id: number, status: Order["status"]): Order {
  return {
    id,
    customer_name: `Customer ${id}`,
    status,
    created_by: 1,
    created_at: "2026-11-22 10:00:00",
    items: [{ product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 1, unit_price: 89, line_total: 89 }],
    total: 89,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue(alice);
  vi.mocked(fetchOrders).mockReset();
});

describe("OrdersPage", () => {
  it("redirects to /login when there is no session", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError(401, "Not authenticated"));

    render(<OrdersPage />);

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("lists the orders and links to the new order page", async () => {
    vi.mocked(fetchOrders).mockResolvedValue([order(2, "paid"), order(1, "pending")]);

    render(<OrdersPage />);

    expect(await screen.findByRole("link", { name: "#2" })).toHaveAttribute("href", "/orders/2");
    expect(screen.getByRole("link", { name: "#1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New order" })).toHaveAttribute("href", "/orders/new");
    expect(fetchOrders).toHaveBeenCalledWith();
  });

  it("filters by status and back to all", async () => {
    vi.mocked(fetchOrders)
      .mockResolvedValueOnce([order(2, "paid"), order(1, "pending")])
      .mockResolvedValueOnce([order(2, "paid")])
      .mockResolvedValueOnce([order(2, "paid"), order(1, "pending")]);
    render(<OrdersPage />);
    await screen.findByRole("link", { name: "#1" });
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Status"), "paid");
    await waitFor(() => expect(screen.queryByRole("link", { name: "#1" })).not.toBeInTheDocument());
    expect(fetchOrders).toHaveBeenLastCalledWith("paid");

    await user.selectOptions(screen.getByLabelText("Status"), "");
    expect(await screen.findByRole("link", { name: "#1" })).toBeInTheDocument();
    expect(fetchOrders).toHaveBeenLastCalledWith(undefined);
  });

  it("sends a rejected session to /login", async () => {
    vi.mocked(fetchOrders).mockRejectedValue(new ApiError(401, "Not authenticated"));

    render(<OrdersPage />);

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("shows an error when the backend cannot be reached", async () => {
    vi.mocked(fetchOrders).mockRejectedValue(new TypeError("Failed to fetch"));

    render(<OrdersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
  });

  it("shows the backend's message when filtering fails", async () => {
    vi.mocked(fetchOrders)
      .mockResolvedValueOnce([order(1, "pending")])
      .mockRejectedValueOnce(new ApiError(500, "Database unavailable"));
    render(<OrdersPage />);
    await screen.findByRole("link", { name: "#1" });

    await userEvent.setup().selectOptions(screen.getByLabelText("Status"), "paid");

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });

  it("signs the user out when filtering is rejected with 401", async () => {
    vi.mocked(fetchOrders)
      .mockResolvedValueOnce([order(1, "pending")])
      .mockRejectedValueOnce(new ApiError(401, "Not authenticated"));
    render(<OrdersPage />);
    await screen.findByRole("link", { name: "#1" });

    await userEvent.setup().selectOptions(screen.getByLabelText("Status"), "paid");

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("disables the status filter while a request is in flight so responses cannot race", async () => {
    let resolve: (orders: Order[]) => void = () => {};
    vi.mocked(fetchOrders)
      .mockResolvedValueOnce([order(2, "paid"), order(1, "pending")])
      .mockReturnValueOnce(new Promise((done) => (resolve = done)));
    render(<OrdersPage />);
    await screen.findByRole("link", { name: "#1" });

    await userEvent.setup().selectOptions(screen.getByLabelText("Status"), "paid");

    expect(screen.getByLabelText("Status")).toBeDisabled();
    resolve([order(2, "paid")]);
    await waitFor(() => expect(screen.getByLabelText("Status")).toBeEnabled());
  });

  it("puts the previous status back when filtering fails", async () => {
    vi.mocked(fetchOrders)
      .mockResolvedValueOnce([order(1, "pending")])
      .mockRejectedValueOnce(new ApiError(500, "Database unavailable"));
    render(<OrdersPage />);
    await screen.findByRole("link", { name: "#1" });

    await userEvent.setup().selectOptions(screen.getByLabelText("Status"), "paid");

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });
});
