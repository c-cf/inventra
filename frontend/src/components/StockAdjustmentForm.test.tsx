
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StockAdjustmentForm } from "./StockAdjustmentForm";
import { adjustStock, ApiError } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  adjustStock: vi.fn(),
}));

const keyboard = {
  id: 1,
  sku: "KB-001",
  name: "Mechanical Keyboard",
  price: 89,
  quantity: 25,
  created_at: "2026-01-01",
};

const onAdjusted = vi.fn();
const onUnauthorized = vi.fn();

function renderForm() {
  return render(
    <StockAdjustmentForm
      token="tok"
      products={[keyboard]}
      onAdjusted={onAdjusted}
      onUnauthorized={onUnauthorized}
    />,
  );
}

beforeEach(() => {
  vi.mocked(adjustStock).mockReset();
  onAdjusted.mockReset();
  onUnauthorized.mockReset();
});

describe("StockAdjustmentForm", () => {
  it("rejects zero stock change", async () => {
    renderForm();

    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByLabelText("Adjust product"),
      "1",
    );

    await user.type(screen.getByLabelText("Stock change"), "0");
    await user.type(
      screen.getByLabelText("Adjustment reason"),
      "restock",
    );

    await user.click(
      screen.getByRole("button", { name: "Adjust Stock" }),
    );

    expect(adjustStock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /non-zero integer/i,
    );
  });

  it("requires an adjustment reason", async () => {
    renderForm();

    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByLabelText("Adjust product"),
      "1",
    );

    await user.type(screen.getByLabelText("Stock change"), "5");

    await user.click(
      screen.getByRole("button", { name: "Adjust Stock" }),
    );

    expect(adjustStock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /reason is required/i,
    );
  });

  it("shows an error when stock is insufficient", async () => {
    vi.mocked(adjustStock).mockRejectedValue(
      new ApiError(409, "Insufficient stock"),
    );

    renderForm();

    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByLabelText("Adjust product"),
      "1",
    );

    await user.type(screen.getByLabelText("Stock change"), "-30");
    await user.type(
      screen.getByLabelText("Adjustment reason"),
      "sold",
    );

    await user.click(
      screen.getByRole("button", { name: "Adjust Stock" }),
    );

    expect(
      await screen.findByText("Insufficient stock"),
    ).toBeInTheDocument();

    expect(onAdjusted).not.toHaveBeenCalled();
  });
});
