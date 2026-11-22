import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderStatusActions } from "@/components/OrderStatusActions";
import { ApiError, updateOrderStatus, type Order, type OrderStatus } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  updateOrderStatus: vi.fn(),
}));

function order(status: OrderStatus): Order {
  return {
    id: 7,
    customer_name: "ACME Corp",
    status,
    created_by: 1,
    created_at: "2026-11-22 10:00:00",
    items: [],
    total: 0,
  };
}

const onChanged = vi.fn();
const onUnauthorized = vi.fn();

function renderActions(status: OrderStatus) {
  render(
    <OrderStatusActions
      token="tok"
      order={order(status)}
      onChanged={onChanged}
      onUnauthorized={onUnauthorized}
    />,
  );
  return userEvent.setup();
}

function buttonNames() {
  return screen.queryAllByRole("button").map((button) => button.textContent);
}

beforeEach(() => {
  vi.mocked(updateOrderStatus).mockReset();
  onChanged.mockReset();
  onUnauthorized.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderStatusActions", () => {
  it.each([
    ["pending", ["Mark as paid", "Cancel order"]],
    ["paid", ["Mark as shipped", "Cancel order"]],
    ["shipped", []],
    ["cancelled", []],
  ] as const)("offers the allowed actions for a %s order", (status, expected) => {
    renderActions(status);

    expect(buttonNames()).toEqual(expected);
  });

  it("says when an order is final", () => {
    renderActions("shipped");

    expect(screen.getByText("No further status changes.")).toBeInTheDocument();
  });

  it.each([
    ["pending", "Mark as paid", "paid"],
    ["paid", "Mark as shipped", "shipped"],
    ["paid", "Cancel order", "cancelled"],
    ["pending", "Cancel order", "cancelled"],
  ] as const)("moves a %s order on '%s'", async (status, button, target) => {
    vi.mocked(updateOrderStatus).mockResolvedValue(order(target));
    const user = renderActions(status);

    await user.click(screen.getByRole("button", { name: button }));

    expect(updateOrderStatus).toHaveBeenCalledWith("tok", 7, target);
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(order(target)));
  });

  it("asks before cancelling and does nothing when the user declines", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = renderActions("pending");

    await user.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Cancel order #7? Its items go back into stock and this cannot be undone.",
    );
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("shows the backend's message when the change is rejected", async () => {
    vi.mocked(updateOrderStatus).mockRejectedValue(
      new ApiError(409, "Cannot change an order from cancelled to paid"),
    );
    const user = renderActions("pending");

    await user.click(screen.getByRole("button", { name: "Mark as paid" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot change an order from cancelled to paid",
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("hands a rejected token to onUnauthorized", async () => {
    vi.mocked(updateOrderStatus).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const user = renderActions("pending");

    await user.click(screen.getByRole("button", { name: "Mark as paid" }));

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables every action while a change is in flight", async () => {
    let resolve: (value: Order) => void = () => {};
    vi.mocked(updateOrderStatus).mockReturnValue(new Promise((done) => (resolve = done)));
    const user = renderActions("pending");

    await user.click(screen.getByRole("button", { name: "Mark as paid" }));

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    resolve(order("paid"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
