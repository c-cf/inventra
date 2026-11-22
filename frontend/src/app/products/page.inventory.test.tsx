import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductsPage from "@/app/products/page";
import {
  ApiError,
  adjustStock,
  createProduct,
  fetchMe,
  fetchProducts,
  fetchStockMovements,
  type Product,
} from "@/lib/api";
import { setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  createProduct: vi.fn(),
  adjustStock: vi.fn(),
  fetchStockMovements: vi.fn(),
}));

const alice = { id: 1, username: "alice", role: "admin" };

function product(overrides: Partial<Product>): Product {
  return {
    id: 1,
    sku: "KB-001",
    name: "Mechanical Keyboard",
    price: 89,
    quantity: 25,
    created_at: "2026-01-01",
    ...overrides,
  };
}

const keyboard = product({});
const cable = product({ id: 2, sku: "CB-001", name: "USB Cable", price: 5, quantity: 2 });

function productTable() {
  return screen.getByRole("table");
}

async function renderFilteredBelow(threshold: string, filtered: Product[]) {
  vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard, cable]).mockResolvedValueOnce(filtered);

  render(<ProductsPage />);
  await screen.findByRole("cell", { name: "Mechanical Keyboard" });

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Low stock threshold"), threshold);
  await user.click(screen.getByRole("button", { name: "Filter" }));

  await waitFor(() => {
    expect(screen.queryByRole("cell", { name: "Mechanical Keyboard" })).not.toBeInTheDocument();
  });
  return user;
}

async function addProduct(user: ReturnType<typeof userEvent.setup>, quantity: string) {
  await user.type(screen.getByLabelText(/sku/i), "MS-002");
  await user.type(screen.getByLabelText(/^name$/i), "Mouse");
  await user.type(screen.getByLabelText(/price/i), "25");
  await user.type(screen.getByLabelText(/quantity/i), quantity);
  await user.click(screen.getByRole("button", { name: /add product/i }));
  await waitFor(() => expect(screen.getByLabelText(/sku/i)).toHaveValue(""));
}

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue(alice);
  vi.mocked(fetchProducts).mockReset();
  vi.mocked(createProduct).mockReset();
  vi.mocked(adjustStock).mockReset();
  vi.mocked(fetchStockMovements).mockReset();
  setToken("tok");
});

describe("ProductsPage with an active low-stock filter", () => {
  it("does not add a created product whose quantity is above the threshold", async () => {
    const user = await renderFilteredBelow("5", [cable]);
    vi.mocked(createProduct).mockResolvedValue(product({ id: 3, sku: "MS-002", name: "Mouse", quantity: 10 }));

    await addProduct(user, "10");

    expect(within(productTable()).queryByText("Mouse")).not.toBeInTheDocument();
    expect(screen.getByText("1 items")).toBeInTheDocument();
  });

  it("does not add a created product whose quantity equals the threshold", async () => {
    const user = await renderFilteredBelow("5", [cable]);
    vi.mocked(createProduct).mockResolvedValue(product({ id: 3, sku: "MS-002", name: "Mouse", quantity: 5 }));

    await addProduct(user, "5");

    expect(within(productTable()).queryByText("Mouse")).not.toBeInTheDocument();
  });

  it("adds a created product whose quantity is below the threshold", async () => {
    const user = await renderFilteredBelow("5", [cable]);
    vi.mocked(createProduct).mockResolvedValue(product({ id: 3, sku: "MS-002", name: "Mouse", quantity: 1 }));

    await addProduct(user, "1");

    expect(within(productTable()).getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("drops an adjusted product that is no longer below the threshold", async () => {
    const user = await renderFilteredBelow("5", [cable]);
    vi.mocked(adjustStock).mockResolvedValue({ ...cable, quantity: 12 });

    await user.selectOptions(screen.getByLabelText("Adjust product"), "2");
    await user.type(screen.getByLabelText("Stock change"), "10");
    await user.type(screen.getByLabelText("Adjustment reason"), "restock");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    expect(await screen.findByText("No products yet.")).toBeInTheDocument();
  });
});

describe("ProductsPage stock movement history", () => {
  it("reloads the displayed history after the stock is adjusted", async () => {
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);
    vi.mocked(fetchStockMovements)
      .mockResolvedValueOnce([
        { id: 1, product_id: 1, change: 5, reason: "restock", created_at: "2026-11-22 10:00:00" },
      ])
      .mockResolvedValueOnce([
        { id: 1, product_id: 1, change: 5, reason: "restock", created_at: "2026-11-22 10:00:00" },
        { id: 2, product_id: 1, change: -3, reason: "damaged", created_at: "2026-11-22 11:00:00" },
      ]);
    vi.mocked(adjustStock).mockResolvedValue({ ...keyboard, quantity: 22 });

    render(<ProductsPage />);
    await screen.findByRole("cell", { name: "Mechanical Keyboard" });
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Movement product"), "1");
    await user.click(screen.getByRole("button", { name: "View Movements" }));
    await screen.findByText("restock");

    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "-3");
    await user.type(screen.getByLabelText("Adjustment reason"), "damaged");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));

    expect(await screen.findByText("damaged")).toBeInTheDocument();
    expect(fetchStockMovements).toHaveBeenCalledTimes(2);
  });
});

describe("ProductsPage low-stock filter controls", () => {
  async function renderPage() {
    vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard, cable]);
    render(<ProductsPage />);
    await screen.findByRole("cell", { name: "Mechanical Keyboard" });
    return userEvent.setup();
  }

  it.each(["", "-1", "2.5"])("rejects the threshold %j without calling the API", async (threshold) => {
    const user = await renderPage();

    if (threshold) await user.type(screen.getByLabelText("Low stock threshold"), threshold);
    await user.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a non-negative integer threshold.");
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });

  it("shows the backend's message when filtering fails", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError(500, "Database unavailable"));

    await user.type(screen.getByLabelText("Low stock threshold"), "5");
    await user.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });

  it("signs the user out when filtering is rejected with 401", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError(401, "Not authenticated"));

    await user.type(screen.getByLabelText("Low stock threshold"), "5");
    await user.click(screen.getByRole("button", { name: "Filter" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(window.localStorage.length).toBe(0);
  });

  it("reloads every product and empties the threshold on clear", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockResolvedValueOnce([cable]).mockResolvedValueOnce([keyboard, cable]);

    await user.type(screen.getByLabelText("Low stock threshold"), "5");
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await waitFor(() => expect(screen.getByText("1 items")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Clear Filter" }));

    expect(await screen.findByText("2 items")).toBeInTheDocument();
    expect(fetchProducts).toHaveBeenLastCalledWith("tok", {});
    expect(screen.getByLabelText("Low stock threshold")).toHaveValue(null);
  });

  it("shows the backend's message when clearing the filter fails", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError(500, "Database unavailable"));

    await user.click(screen.getByRole("button", { name: "Clear Filter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });

  it("signs the user out when clearing the filter is rejected with 401", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError(401, "Not authenticated"));

    await user.click(screen.getByRole("button", { name: "Clear Filter" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });
});
