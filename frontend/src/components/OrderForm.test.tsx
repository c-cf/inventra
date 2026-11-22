import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderForm } from "@/components/OrderForm";
import { ApiError, createOrder, type Order, type Product } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createOrder: vi.fn(),
}));

const keyboard: Product = { id: 1, sku: "KB-001", name: "Keyboard", price: 89, quantity: 10, created_at: "x" };
const mouse: Product = { id: 2, sku: "MS-001", name: "Mouse", price: 25.5, quantity: 3, created_at: "x" };
const hub: Product = { id: 3, sku: "HB-001", name: "USB Hub", price: 39.9, quantity: 0, created_at: "x" };

const created: Order = {
  id: 7,
  customer_name: "ACME Corp",
  status: "pending",
  created_by: 1,
  created_at: "2026-11-22 10:00:00",
  items: [{ product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 2, unit_price: 89, line_total: 178 }],
  total: 178,
};

const onCreated = vi.fn();
const onUnauthorized = vi.fn();

function renderForm() {
  render(
    <OrderForm
      token="tok"
      products={[keyboard, mouse, hub]}
      onCreated={onCreated}
      onUnauthorized={onUnauthorized}
    />,
  );
  return userEvent.setup();
}

async function fillLine(user: ReturnType<typeof userEvent.setup>, n: number, productId: string, qty: string) {
  await user.selectOptions(screen.getByLabelText(`Product ${n}`), productId);
  await user.clear(screen.getByLabelText(`Quantity ${n}`));
  await user.type(screen.getByLabelText(`Quantity ${n}`), qty);
}

beforeEach(() => {
  vi.mocked(createOrder).mockReset();
  onCreated.mockReset();
  onUnauthorized.mockReset();
});

describe("OrderForm", () => {
  it("places the order with a trimmed customer name and reports it", async () => {
    vi.mocked(createOrder).mockResolvedValue(created);
    const user = renderForm();

    await user.type(screen.getByLabelText("Customer"), "  ACME Corp  ");
    await fillLine(user, 1, "1", "2");
    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(createOrder).toHaveBeenCalledWith("tok", {
      customer_name: "ACME Corp",
      items: [{ product_id: 1, quantity: 2 }],
    });
  });

  it("shows a running total of the selected lines", async () => {
    const user = renderForm();

    expect(screen.getByText("Total: $0.00")).toBeInTheDocument();
    await fillLine(user, 1, "1", "2");

    expect(screen.getByText("Total: $178.00")).toBeInTheDocument();
  });

  it("lists stock next to each product and disables out-of-stock ones", () => {
    renderForm();

    expect(screen.getByRole("option", { name: "Keyboard (KB-001) · 10 in stock" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "USB Hub (HB-001) · 0 in stock" })).toBeDisabled();
  });
});
