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

  it("hides the history of a product that is no longer in the list", async () => {
    vi.mocked(fetchStockMovements).mockResolvedValue([restock]);
    const { rerender } = render(
      <StockMovementHistory token="tok" products={products} onUnauthorized={onUnauthorized} />,
    );
    const user = userEvent.setup();

    await view(user, "1");
    await screen.findByText("restock");
    rerender(
      <StockMovementHistory token="tok" products={[products[1]]} onUnauthorized={onUnauthorized} />,
    );

    expect(screen.queryByText("restock")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View Movements" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please select a product.");
    expect(fetchStockMovements).toHaveBeenCalledOnce();
  });

  describe("when refreshKey changes", () => {
    function historyWith(refreshKey: number) {
      return (
        <StockMovementHistory
          token="tok"
          products={products}
          onUnauthorized={onUnauthorized}
          refreshKey={refreshKey}
        />
      );
    }

    async function viewThenRefreshWith(outcome: () => Promise<StockMovement[]>) {
      vi.mocked(fetchStockMovements)
        .mockResolvedValueOnce([restock])
        .mockImplementationOnce(outcome);
      const { rerender } = render(historyWith(0));
      const user = userEvent.setup();
      await view(user, "1");
      await screen.findByText("restock");
      rerender(historyWith(1));
      return rerender;
    }

    it("shows only the error when the refresh fails", async () => {
      await viewThenRefreshWith(() => Promise.reject(new ApiError(500, "Database unavailable")));

      expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
      expect(screen.queryByText("No stock movements found.")).not.toBeInTheDocument();
    });

    it("clears the error once a later refresh succeeds", async () => {
      const rerender = await viewThenRefreshWith(() =>
        Promise.reject(new ApiError(500, "Database unavailable")),
      );
      await screen.findByRole("alert");
      vi.mocked(fetchStockMovements).mockResolvedValueOnce([restock]);

      rerender(historyWith(2));

      expect(await screen.findByText("restock")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("hands a 401 to onUnauthorized", async () => {
      await viewThenRefreshWith(() => Promise.reject(new ApiError(401, "Not authenticated")));

      await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("refreshes even when the first load is still in flight", async () => {
      const damaged: StockMovement = { ...restock, id: 2, change: -3, reason: "damaged" };
      vi.mocked(fetchStockMovements)
        .mockReturnValueOnce(new Promise(() => {}))
        .mockResolvedValueOnce([restock, damaged]);
      const { rerender } = render(historyWith(0));
      const user = userEvent.setup();

      await view(user, "1");
      rerender(historyWith(1));

      expect(await screen.findByText("damaged")).toBeInTheDocument();
      expect(fetchStockMovements).toHaveBeenCalledTimes(2);
    });
  });
});
