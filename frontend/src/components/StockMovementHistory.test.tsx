import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StockMovementHistory } from "@/components/StockMovementHistory";
import { ApiError, fetchStockMovements, type StockMovement } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchStockMovements: vi.fn(),
}));

const products = [
  { id: 1, sku: "KB-001", name: "Mechanical Keyboard", price: 89, quantity: 25, created_at: "2026-01-01" },
  { id: 2, sku: "MS-001", name: "Wireless Mouse", price: 29.5, quantity: 40, created_at: "2026-01-01" },
];

const restock: StockMovement = {
  id: 1,
  product_id: 1,
  change: 5,
  reason: "restock",
  created_at: "2026-11-22 10:00:00",
};

const onUnauthorized = vi.fn();

function renderHistory() {
  render(<StockMovementHistory token="tok" products={products} onUnauthorized={onUnauthorized} />);
  return userEvent.setup();
}

async function view(user: ReturnType<typeof userEvent.setup>, productId: string) {
  await user.selectOptions(screen.getByLabelText("Movement product"), productId);
  await user.click(screen.getByRole("button", { name: "View Movements" }));
}

beforeEach(() => {
  vi.mocked(fetchStockMovements).mockReset();
  onUnauthorized.mockReset();
});

describe("StockMovementHistory", () => {
  it("asks for a product before fetching anything", async () => {
    const user = renderHistory();

    await user.click(screen.getByRole("button", { name: "View Movements" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please select a product.");
    expect(fetchStockMovements).not.toHaveBeenCalled();
  });

  it("says so when a product has no movements", async () => {
    vi.mocked(fetchStockMovements).mockResolvedValue([]);
    const user = renderHistory();

    await view(user, "1");

    expect(await screen.findByText("No stock movements found.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the backend's message when loading fails", async () => {
    vi.mocked(fetchStockMovements).mockRejectedValue(new ApiError(404, "Product not found"));
    const user = renderHistory();

    await view(user, "1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Product not found");
  });

  it("hands a rejected token to onUnauthorized instead of showing an error", async () => {
    vi.mocked(fetchStockMovements).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const user = renderHistory();

    await view(user, "1");

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the shown history when another product is selected", async () => {
    vi.mocked(fetchStockMovements).mockResolvedValue([restock]);
    const user = renderHistory();

    await view(user, "1");
    await screen.findByText("restock");
    await user.selectOptions(screen.getByLabelText("Movement product"), "2");

    expect(screen.queryByText("restock")).not.toBeInTheDocument();
  });

  it("ignores a response that arrives after the selection changed", async () => {
    let resolve: (movements: StockMovement[]) => void = () => {};
    vi.mocked(fetchStockMovements).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const user = renderHistory();

    await view(user, "1");
    await user.selectOptions(screen.getByLabelText("Movement product"), "2");
    resolve([restock]);

    await screen.findByRole("button", { name: "View Movements" });
    expect(screen.queryByText("restock")).not.toBeInTheDocument();
  });
});
