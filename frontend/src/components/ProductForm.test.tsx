import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "@/components/ProductForm";
import { createProduct } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createProduct: vi.fn(),
}));

const createProductMock = vi.mocked(createProduct);

async function fillAndSubmit(fields: { sku?: string; name?: string; price?: string; quantity?: string }) {
  const user = userEvent.setup();
  if (fields.sku) await user.type(screen.getByLabelText(/sku/i), fields.sku);
  if (fields.name) await user.type(screen.getByLabelText(/name/i), fields.name);
  if (fields.price) await user.type(screen.getByLabelText(/price/i), fields.price);
  if (fields.quantity) await user.type(screen.getByLabelText(/quantity/i), fields.quantity);
  await user.click(screen.getByRole("button", { name: /add product/i }));
}

beforeEach(() => {
  createProductMock.mockReset();
});

describe("ProductForm", () => {
  it("submits the entered product and reports the created one", async () => {
    const created = { id: 7, sku: "MS-002", name: "Mouse", price: 25, quantity: 10, created_at: "2026-11-09" };
    createProductMock.mockResolvedValue(created);
    const onCreated = vi.fn();
    render(<ProductForm token="tok" onCreated={onCreated} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/sku/i), "MS-002");
    await user.type(screen.getByLabelText(/name/i), "Mouse");
    await user.type(screen.getByLabelText(/price/i), "25");
    await user.type(screen.getByLabelText(/quantity/i), "10");
    await user.click(screen.getByRole("button", { name: /add product/i }));

    expect(createProductMock).toHaveBeenCalledWith("tok", {
      sku: "MS-002",
      name: "Mouse",
      price: 25,
      quantity: 10,
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));

  it("requires a SKU and does not call the API without one", async () => {
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ name: "Mouse", price: "25", quantity: "10" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/sku is required/i);
    expect(createProductMock).not.toHaveBeenCalled();
    });

  it("rejects a negative price", async () => {
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ sku: "MS-002", name: "Mouse", price: "-5", quantity: "10" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/price must be 0 or more/i);
    expect(createProductMock).not.toHaveBeenCalled();
    });

  it("rejects a quantity that is not a whole number", async () => {
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ sku: "MS-002", name: "Mouse", price: "25", quantity: "2.5" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/quantity must be a whole number/i);
    expect(createProductMock).not.toHaveBeenCalled();
    });
  });
});