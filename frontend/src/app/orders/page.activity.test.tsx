import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrdersPage from "@/app/orders/page";
import { ApiError, fetchMe, fetchOrders, type Order, type OrderStatus } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchOrders: vi.fn(),
}));

function order(id: number, status: OrderStatus): Order {
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

const allOrders = [order(3, "shipped"), order(2, "paid"), order(1, "pending")];
const paidOrders = allOrders.filter((o) => o.status === "paid");

/** Answers like the API: every order, or only those with the given status. */
async function serveOrders(status?: OrderStatus): Promise<Order[]> {
  return allOrders.filter((o) => status === undefined || o.status === status);
}

// Next.js (Cache Components) keeps a visited page mounted inside <Activity mode="hidden">
// and runs its effects again when the user comes back, which reloads the orders.
function page(mode: "visible" | "hidden") {
  return (
    <Activity mode={mode}>
      <OrdersPage />
    </Activity>
  );
}

function listedOrders(): string[] {
  return screen.queryAllByRole("link", { name: /^#\d+$/ }).map((link) => link.textContent ?? "");
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

async function renderPage() {
  const view = render(page("visible"));
  await screen.findByRole("link", { name: "#1" });
  return { ...view, user: userEvent.setup() };
}

async function leaveAndComeBack(rerender: (ui: ReactNode) => void) {
  const loadsBefore = vi.mocked(fetchOrders).mock.calls.length;
  rerender(page("hidden"));
  rerender(page("visible"));
  await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(loadsBefore + 1));
}

beforeEach(() => {
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchOrders).mockReset().mockImplementation(serveOrders);
});

describe("OrdersPage when the user comes back to it (#37)", () => {
  it("reloads with the status that was applied", async () => {
    const { rerender, user } = await renderPage();
    await user.selectOptions(screen.getByLabelText("Status"), "paid");
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));

    await leaveAndComeBack(rerender);

    expect(fetchOrders).toHaveBeenLastCalledWith("paid");
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));
    expect(screen.getByLabelText("Status")).toHaveValue("paid");
  });

  it("asks again when the status is changed before the reload lands", async () => {
    const { rerender, user } = await renderPage();
    await user.selectOptions(screen.getByLabelText("Status"), "paid");
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));
    const reload = deferred<Order[]>();
    vi.mocked(fetchOrders).mockReturnValueOnce(reload.promise);

    await leaveAndComeBack(rerender);
    await user.selectOptions(screen.getByLabelText("Status"), "");
    await waitFor(() => expect(listedOrders()).toEqual(["#3", "#2", "#1"]));
    await act(async () => reload.resolve(paidOrders)); // the reload for "paid" lands last

    // load, filter, reload, back to all, and once more for all
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(5));
    expect(fetchOrders).toHaveBeenLastCalledWith(undefined);
    await waitFor(() => expect(listedOrders()).toEqual(["#3", "#2", "#1"]));
  });

  it("honours a status filter that was still on its way when the user left", async () => {
    const { rerender, user } = await renderPage();
    const filter = deferred<Order[]>();
    const reload = deferred<Order[]>();
    vi.mocked(fetchOrders).mockReturnValueOnce(filter.promise).mockReturnValueOnce(reload.promise);
    await user.selectOptions(screen.getByLabelText("Status"), "paid");

    await leaveAndComeBack(rerender); // asks with the status applied so far: all
    await act(async () => filter.resolve(paidOrders));
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));
    await act(async () => reload.resolve(allOrders)); // the unfiltered reload lands last

    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(4));
    expect(fetchOrders).toHaveBeenLastCalledWith("paid");
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));
  });

  it("reloads with the status still applied after a filter failed", async () => {
    const { rerender, user } = await renderPage();
    await user.selectOptions(screen.getByLabelText("Status"), "paid");
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));
    vi.mocked(fetchOrders).mockRejectedValueOnce(new ApiError(500, "Database unavailable"));
    await user.selectOptions(screen.getByLabelText("Status"), "shipped");
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Status")).toHaveValue("paid");

    await leaveAndComeBack(rerender);

    expect(fetchOrders).toHaveBeenLastCalledWith("paid");
    await waitFor(() => expect(listedOrders()).toEqual(["#2"]));
  });
});
