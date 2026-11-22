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

  describe("validation", () => {
    it.each([
      ["a blank customer", "   ", "1", "2", "Customer is required."],
      ["a line without a product", "ACME", "", "2", "Choose a product for line 1."],
      ["a zero quantity", "ACME", "1", "0", "Quantity for line 1 must be a whole number of 1 or more."],
      ["a fractional quantity", "ACME", "1", "1.5", "Quantity for line 1 must be a whole number of 1 or more."],
      ["more than is in stock", "ACME", "2", "4", "Only 3 of MS-001 in stock."],
    ])("rejects %s without calling the API", async (_case, customer, productId, qty, message) => {
      const user = renderForm();

      await user.type(screen.getByLabelText("Customer"), customer);
      if (productId) await user.selectOptions(screen.getByLabelText("Product 1"), productId);
      await user.clear(screen.getByLabelText("Quantity 1"));
      await user.type(screen.getByLabelText("Quantity 1"), qty);
      await user.click(screen.getByRole("button", { name: "Place order" }));

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(createOrder).not.toHaveBeenCalled();
    });
  });

  describe("with several lines", () => {
    it("adds lines, totals them and sends every item", async () => {
      vi.mocked(createOrder).mockResolvedValue(created);
      const user = renderForm();

      await user.type(screen.getByLabelText("Customer"), "ACME Corp");
      await fillLine(user, 1, "1", "2");
      await user.click(screen.getByRole("button", { name: "Add line" }));
      await fillLine(user, 2, "2", "3");

      expect(screen.getByText("Total: $254.50")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Place order" }));

      await waitFor(() => expect(createOrder).toHaveBeenCalledOnce());
      expect(createOrder).toHaveBeenCalledWith("tok", {
        customer_name: "ACME Corp",
        items: [
          { product_id: 1, quantity: 2 },
          { product_id: 2, quantity: 3 },
        ],
      });
    });

    it("removes a line", async () => {
      const user = renderForm();

      await fillLine(user, 1, "1", "2");
      await user.click(screen.getByRole("button", { name: "Add line" }));
      await fillLine(user, 2, "2", "1");
      await user.click(screen.getByRole("button", { name: "Remove line 1" }));

      expect(screen.queryByLabelText("Product 2")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Product 1")).toHaveValue("2");
      expect(screen.getByText("Total: $25.50")).toBeInTheDocument();
    });

    it("does not offer to remove the only line", () => {
      renderForm();

      expect(screen.queryByRole("button", { name: /remove line/i })).not.toBeInTheDocument();
    });

    it("rejects the same product on two lines", async () => {
      const user = renderForm();

      await user.type(screen.getByLabelText("Customer"), "ACME Corp");
      await fillLine(user, 1, "1", "1");
      await user.click(screen.getByRole("button", { name: "Add line" }));
      await fillLine(user, 2, "1", "1");
      await user.click(screen.getByRole("button", { name: "Place order" }));

      expect(screen.getByRole("alert")).toHaveTextContent("KB-001 is on more than one line.");
      expect(createOrder).not.toHaveBeenCalled();
    });
  });

  describe("when the API call fails or is slow", () => {
    async function submitValidOrder(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText("Customer"), "ACME Corp");
      await fillLine(user, 1, "1", "2");
      await user.click(screen.getByRole("button", { name: "Place order" }));
    }

    it("shows the backend's message", async () => {
      vi.mocked(createOrder).mockRejectedValue(new ApiError(409, "Insufficient stock for KB-001"));
      const user = renderForm();

      await submitValidOrder(user);

      expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient stock for KB-001");
      expect(onCreated).not.toHaveBeenCalled();
    });

    it("shows a generic message when the backend cannot be reached", async () => {
      vi.mocked(createOrder).mockRejectedValue(new TypeError("Failed to fetch"));
      const user = renderForm();

      await submitValidOrder(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not reach the server. Is the backend running?",
      );
    });

    it("hands a rejected token to onUnauthorized", async () => {
      vi.mocked(createOrder).mockRejectedValue(new ApiError(401, "Not authenticated"));
      const user = renderForm();

      await submitValidOrder(user);

      await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("disables the submit button while the order is being placed", async () => {
      let resolve: (order: Order) => void = () => {};
      vi.mocked(createOrder).mockReturnValue(new Promise((done) => (resolve = done)));
      const user = renderForm();

      await submitValidOrder(user);

      expect(screen.getByRole("button", { name: "Placing…" })).toBeDisabled();
      resolve(created);
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    });
  });

  it("stays disabled after a successful order so a second click cannot place it twice", async () => {
    vi.mocked(createOrder).mockResolvedValue(created);
    const user = renderForm();

    await user.type(screen.getByLabelText("Customer"), "ACME Corp");
    await fillLine(user, 1, "1", "2");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: /plac/i }));

    expect(createOrder).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /plac/i })).toBeDisabled();
  });
});
