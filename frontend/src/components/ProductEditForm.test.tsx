import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductEditForm } from "@/components/ProductEditForm";
import { updateProduct, type Product } from "@/lib/api";

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
});
