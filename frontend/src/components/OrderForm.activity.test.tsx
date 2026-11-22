import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderForm } from "@/components/OrderForm";
import { createOrder, type Order, type Product } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createOrder: vi.fn(),
}));

const keyboard: Product = { id: 1, sku: "KB-001", name: "Keyboard", price: 89, quantity: 10, created_at: "x" };

const created: Order = {
  id: 7,
  customer_name: "ACME Corp",
  status: "pending",
  created_by: 1,
  created_at: "2026-11-22 10:00:00",
  items: [{ product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 2, unit_price: 89, line_total: 178 }],
  total: 178,
};

// Next.js (Cache Components) keeps a visited page mounted inside <Activity mode="hidden">
// and shows it again on the way back, so a page's form outlives the navigation.
function page(mode: "visible" | "hidden") {
  return (
    <Activity mode={mode}>
      <OrderForm products={[keyboard]} onCreated={() => {}} onUnauthorized={() => {}} />
    </Activity>
  );
}

beforeEach(() => {
  vi.mocked(createOrder).mockReset();
});

describe("OrderForm on a page that Next keeps mounted", () => {
  it("starts empty again when the user comes back after placing an order (#25)", async () => {
    vi.mocked(createOrder).mockResolvedValue(created);
    const { rerender } = render(page("visible"));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Customer"), "ACME Corp");
    await user.selectOptions(screen.getByLabelText("Product 1"), "1");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledOnce());

    rerender(page("hidden"));
    rerender(page("visible"));

    expect(screen.getByLabelText("Customer")).toHaveValue("");
    expect(screen.getByLabelText("Product 1")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
  });

  it("starts empty again when the order went through after the user had left", async () => {
    let finishOrder: (order: Order) => void = () => {};
    vi.mocked(createOrder).mockReturnValue(
      new Promise<Order>((resolve) => {
        finishOrder = resolve;
      }),
    );
    const { rerender } = render(page("visible"));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Customer"), "ACME Corp");
    await user.selectOptions(screen.getByLabelText("Product 1"), "1");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(screen.getByRole("button", { name: "Placing…" })).toBeDisabled();

    rerender(page("hidden"));
    await act(async () => finishOrder(created));
    rerender(page("visible"));

    expect(screen.getByLabelText("Customer")).toHaveValue("");
    expect(screen.getByLabelText("Product 1")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
  });

  it("keeps an unsent draft when the user leaves and comes back", async () => {
    const { rerender } = render(page("visible"));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Customer"), "Draft Customer");

    rerender(page("hidden"));
    rerender(page("visible"));

    expect(screen.getByLabelText("Customer")).toHaveValue("Draft Customer");
  });
});
