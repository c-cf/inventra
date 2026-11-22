import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductEditForm } from "@/components/ProductEditForm";
import { ApiError, updateProduct, type Product } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  updateProduct: vi.fn(),
}));

const keyboard: Product = {
  id: 1,
  sku: "KB-001",
  name: "Mechanical Keyboard",
  price: 89,
  quantity: 25,
  created_at: "2026-01-01",
};

const onSaved = vi.fn();
const onUnauthorized = vi.fn();

function renderForm() {
  render(
    <ProductEditForm
      token="tok"
      product={keyboard}
      onSaved={onSaved}
      onUnauthorized={onUnauthorized}
    />,
  );
  return userEvent.setup();
}

async function replace(user: ReturnType<typeof userEvent.setup>, label: RegExp, value: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value) await user.type(input, value);
}

beforeEach(() => {
  vi.mocked(updateProduct).mockReset();
  onSaved.mockReset();
  onUnauthorized.mockReset();
});

describe("ProductEditForm", () => {
  it("starts with the product's current values", () => {
    renderForm();

    expect(screen.getByLabelText(/sku/i)).toHaveValue("KB-001");
    expect(screen.getByLabelText(/name/i)).toHaveValue("Mechanical Keyboard");
    expect(screen.getByLabelText(/price/i)).toHaveValue(89);
  });

  it("sends only the changed fields, trimmed, and reports the saved product", async () => {
    const saved = { ...keyboard, name: "Keyboard", price: 79.5 };
    vi.mocked(updateProduct).mockResolvedValue(saved);
    const user = renderForm();

    await replace(user, /name/i, "  Keyboard  ");
    await replace(user, /price/i, "79.5");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(updateProduct).toHaveBeenCalledWith("tok", 1, { name: "Keyboard", price: 79.5 });
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("does not call the API when nothing changed", async () => {
    const user = renderForm();

    await replace(user, /name/i, "Mechanical Keyboard ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateProduct).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No changes to save.");
  });

  it.each([
    [/sku/i, "", "SKU is required."],
    [/sku/i, "x".repeat(65), "SKU must be 64 characters or fewer."],
    [/name/i, "   ", "Name is required."],
    [/name/i, "x".repeat(201), "Name must be 200 characters or fewer."],
    [/price/i, "", "Price is required."],
    [/price/i, "-1", "Price must be 0 or more."],
    [/price/i, "1000000000.01", "Price must be 1,000,000,000 or less."],
  ])("rejects %s = %j without calling the API", async (label, value, message) => {
    const user = renderForm();

    await replace(user, label, value);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("shows the backend's message for a duplicate SKU", async () => {
    vi.mocked(updateProduct).mockRejectedValue(new ApiError(409, "SKU already exists"));
    const user = renderForm();

    await replace(user, /sku/i, "MS-001");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SKU already exists");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("hands a rejected token to onUnauthorized", async () => {
    vi.mocked(updateProduct).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const user = renderForm();

    await replace(user, /name/i, "Keyboard");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables saving while the request is in flight", async () => {
    let resolve: (product: Product) => void = () => {};
    vi.mocked(updateProduct).mockReturnValue(new Promise((done) => (resolve = done)));
    const user = renderForm();

    await replace(user, /name/i, "Keyboard");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    resolve({ ...keyboard, name: "Keyboard" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
  });

  it("treats a price typed as 89.00 as unchanged", async () => {
    const user = renderForm();

    // userEvent.type collapses "89.00" to "89" in jsdom, so set the raw value directly.
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "89.00" } });
    expect(screen.getByLabelText(/price/i)).toHaveDisplayValue("89.00");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateProduct).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No changes to save.");
  });

  it("trims a changed SKU before sending it", async () => {
    vi.mocked(updateProduct).mockResolvedValue({ ...keyboard, sku: "KB-002" });
    const user = renderForm();

    await replace(user, /sku/i, "  KB-002  ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith("tok", 1, { sku: "KB-002" }));
  });
});
