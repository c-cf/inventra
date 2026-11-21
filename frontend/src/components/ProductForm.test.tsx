import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "@/components/ProductForm";
import { ApiError, createProduct, type Product } from "@/lib/api";

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
  });

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

  it("requires a name and does not call the API without one", async () => {
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ sku: "MS-002", price: "25", quantity: "10" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/name is required/i);
    expect(createProductMock).not.toHaveBeenCalled();
  });

  it("shows the backend's message when the SKU already exists", async () => {
    createProductMock.mockRejectedValue(new ApiError(409, "SKU already exists"));
    const onCreated = vi.fn();
    render(<ProductForm token="tok" onCreated={onCreated} />);

    await fillAndSubmit({ sku: "KB-001", name: "Keyboard", price: "89", quantity: "5" });

    expect(await screen.findByRole("alert")).toHaveTextContent("SKU already exists");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("requires a price and does not call the API without one", async () => {
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ sku: "MS-002", name: "Mouse", quantity: "10" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/price is required/i);
    expect(createProductMock).not.toHaveBeenCalled();
  });

  it("trims the SKU and name before submitting", async () => {
    const created = { id: 8, sku: "KB-002", name: "Mouse", price: 25, quantity: 10, created_at: "2026-11-18" };
    createProductMock.mockResolvedValue(created);
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ sku: "  KB-002  ", name: "  Mouse  ", price: "25", quantity: "10" });

    expect(createProductMock).toHaveBeenCalledWith("tok", {
      sku: "KB-002",
      name: "Mouse",
      price: 25,
      quantity: 10,
    });
  });

  it("disables the submit button while the request is in flight", async () => {
    const created = { id: 9, sku: "MS-002", name: "Mouse", price: 25, quantity: 10, created_at: "2026-11-22" };
    let resolveCreate!: (value: Product) => void;
    createProductMock.mockReturnValue(new Promise<Product>((resolve) => (resolveCreate = resolve)));
    render(<ProductForm token="tok" onCreated={vi.fn()} />);

    await fillAndSubmit({ sku: "MS-002", name: "Mouse", price: "25", quantity: "10" });

    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    resolveCreate(created);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add product/i })).not.toBeDisabled(),
    );
  });
});
