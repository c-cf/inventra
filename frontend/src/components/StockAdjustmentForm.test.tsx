
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
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

  it("hands a rejected token to onUnauthorized instead of showing an error", async () => {
    vi.mocked(adjustStock).mockRejectedValue(new ApiError(401, "Not authenticated"));

    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "5");
    await user.type(screen.getByLabelText("Adjustment reason"), "restock");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports the adjusted product and clears the change and reason", async () => {
    vi.mocked(adjustStock).mockResolvedValue({ ...keyboard, quantity: 30 });

    renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "5");
    await user.type(screen.getByLabelText("Adjustment reason"), "  restock  ");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    await vi.waitFor(() => expect(onAdjusted).toHaveBeenCalledWith({ ...keyboard, quantity: 30 }));
    expect(adjustStock).toHaveBeenCalledWith(1, 5, "restock");
    expect(screen.getByLabelText("Stock change")).toHaveValue(null);
    expect(screen.getByLabelText("Adjustment reason")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mechanical Keyboard now has 30 in stock.",
    );
  });

  it("drops the last confirmation when the next adjustment fails", async () => {
    vi.mocked(adjustStock)
      .mockResolvedValueOnce({ ...keyboard, quantity: 30 })
      .mockRejectedValueOnce(new ApiError(409, "Insufficient stock"));
    renderForm();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "5");
    await user.type(screen.getByLabelText("Adjustment reason"), "restock");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Stock change"), "-99");
    await user.type(screen.getByLabelText("Adjustment reason"), "damaged");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient stock");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("drops the last confirmation when the next attempt fails validation", async () => {
    vi.mocked(adjustStock).mockResolvedValue({ ...keyboard, quantity: 30 });
    renderForm();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "5");
    await user.type(screen.getByLabelText("Adjustment reason"), "restock");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/non-zero integer/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("drops the confirmation once the user leaves the page Next keeps mounted", async () => {
    // Next.js keeps /products mounted in a hidden <Activity> and reloads the products
    // when it is shown again; an old "now has N" could contradict the fresh table.
    vi.mocked(adjustStock).mockResolvedValue({ ...keyboard, quantity: 30 });
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <StockAdjustmentForm
          products={[keyboard]}
          onAdjusted={onAdjusted}
          onUnauthorized={onUnauthorized}
        />
      </Activity>
    );
    const { rerender } = render(page("visible"));
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "5");
    await user.type(screen.getByLabelText("Adjustment reason"), "restock");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    rerender(page("hidden"));
    rerender(page("visible"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("forgets a selected product once it is no longer in the list", async () => {
    const { rerender } = renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    rerender(
      <StockAdjustmentForm
        products={[]}
        onAdjusted={onAdjusted}
        onUnauthorized={onUnauthorized}
      />,
    );
    await user.type(screen.getByLabelText("Stock change"), "-1");
    await user.type(screen.getByLabelText("Adjustment reason"), "oops");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    expect(adjustStock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/select a product/i);
  });
});
