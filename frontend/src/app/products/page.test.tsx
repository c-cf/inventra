
import { render, screen, waitFor } from "@testing-library/react";
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
} from "@/lib/api";

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  createProduct: vi.fn(),
  adjustStock: vi.fn(),
  fetchStockMovements: vi.fn(),
}));

const alice = {
  id: 1,
  username: "alice",
  role: "admin",
};

const keyboard = {
  id: 1,
  sku: "KB-001",
  name: "Mechanical Keyboard",
  price: 89,
  quantity: 25,
  created_at: "2026-01-01",
};

beforeEach(() => {
  window.localStorage.clear();

  router.replace.mockReset();
  router.push.mockReset();

  vi.mocked(fetchStockMovements).mockReset();
  vi.mocked(fetchMe).mockReset();
  vi.mocked(fetchProducts).mockReset();
  vi.mocked(createProduct).mockReset();
  vi.mocked(adjustStock).mockReset();
});

describe("ProductsPage", () => {
  it("redirects to /login when there is no session", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError(401, "Not authenticated"));

    render(<ProductsPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });

  it("shows the signed-in user and the product list", async () => {

    vi.mocked(fetchMe).mockResolvedValue(alice);
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);

    render(<ProductsPage />);

    expect(
      await screen.findByText("Mechanical Keyboard"),
    ).toBeInTheDocument();

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(fetchProducts).toHaveBeenCalledWith();
  });

  it("sends a rejected session to /login", async () => {

    vi.mocked(fetchMe).mockRejectedValue(
      new ApiError(401, "Not authenticated"),
    );

    vi.mocked(fetchProducts).mockRejectedValue(
      new ApiError(401, "Not authenticated"),
    );

    render(<ProductsPage />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/login");
    });
  });

  it("shows an error when the backend cannot be reached", async () => {

    vi.mocked(fetchMe).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    vi.mocked(fetchProducts).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    render(<ProductsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to fetch/i,
    );

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("adds a newly created product to the table", async () => {

    vi.mocked(fetchMe).mockResolvedValue(alice);
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);

    const mouse = {
      id: 2,
      sku: "MS-002",
      name: "Mouse",
      price: 25,
      quantity: 10,
      created_at: "2026-11-09",
    };

    vi.mocked(createProduct).mockResolvedValue(mouse);

    render(<ProductsPage />);

    await screen.findByText("Mechanical Keyboard");

    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/sku/i), "MS-002");
    await user.type(screen.getByLabelText(/name/i), "Mouse");
    await user.type(screen.getByLabelText(/price/i), "25");
    await user.type(screen.getByLabelText(/quantity/i), "10");

    await user.click(
      screen.getByRole("button", { name: /add product/i }),
    );

    expect(createProduct).toHaveBeenCalledWith({
      sku: "MS-002",
      name: "Mouse",
      price: 25,
      quantity: 10,
    });

    expect(await screen.findByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("sends the user to /login when creating a product is rejected with 401", async () => {

    vi.mocked(fetchMe).mockResolvedValue(alice);
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);

    vi.mocked(createProduct).mockRejectedValue(
      new ApiError(401, "Not authenticated"),
    );

    render(<ProductsPage />);

    await screen.findByText("Mechanical Keyboard");

    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/sku/i), "MS-002");
    await user.type(screen.getByLabelText(/name/i), "Mouse");
    await user.type(screen.getByLabelText(/price/i), "25");
    await user.type(screen.getByLabelText(/quantity/i), "10");

    await user.click(
      screen.getByRole("button", { name: /add product/i }),
    );

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/login");
    });
  });

  // Inventory TDD: Low Stock Filter
  it("filters products by low stock threshold", async () => {

    vi.mocked(fetchMe).mockResolvedValue(alice);

    vi.mocked(fetchProducts)
      .mockResolvedValueOnce([keyboard])
      .mockResolvedValueOnce([]);

    render(<ProductsPage />);

    await screen.findByText("Mechanical Keyboard");

    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("Low stock threshold"),
      "5",
    );

    await user.click(
      screen.getByRole("button", { name: "Filter" }),
    );

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({ below: 5 });
    });

    expect(
      await screen.findByText("No products yet."),
    ).toBeInTheDocument();
  });

  // Inventory TDD: Stock Adjustment
  it("adjusts product stock and updates the displayed quantity", async () => {

    vi.mocked(fetchMe).mockResolvedValue(alice);
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);

    vi.mocked(adjustStock).mockResolvedValue({
      ...keyboard,
      quantity: 30,
    });

    render(<ProductsPage />);

    await screen.findByText("Mechanical Keyboard");

    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByLabelText("Adjust product"),
      "1",
    );

    await user.type(
      screen.getByLabelText("Stock change"),
      "5",
    );

    await user.type(
      screen.getByLabelText("Adjustment reason"),
      "restock",
    );

    await user.click(
      screen.getByRole("button", { name: "Adjust Stock" }),
    );

    await waitFor(() => {
      expect(adjustStock).toHaveBeenCalledWith(1,
        5,
        "restock",
      );
    });

    expect(
      await screen.findByText("30"),
    ).toBeInTheDocument();
  });
});


it("displays stock movement history for a selected product", async () => {

  vi.mocked(fetchMe).mockResolvedValue(alice);
  vi.mocked(fetchProducts).mockResolvedValue([keyboard]);

  vi.mocked(fetchStockMovements).mockResolvedValue([
    {
      id: 1,
      product_id: 1,
      change: 5,
      reason: "restock",
      created_at: "2026-11-22T10:00:00",
    },
    {
      id: 2,
      product_id: 1,
      change: -2,
      reason: "sold",
      created_at: "2026-11-22T11:00:00",
    },
  ]);

  render(<ProductsPage />);

  await screen.findByText("Mechanical Keyboard");

  const user = userEvent.setup();

  await user.selectOptions(
    screen.getByLabelText("Movement product"),
    "1",
  );

  await user.click(
    screen.getByRole("button", { name: "View Movements" }),
  );

  await waitFor(() => {
    expect(fetchStockMovements).toHaveBeenCalledWith(1);
  });

  expect(await screen.findByText("restock")).toBeInTheDocument();
  expect(screen.getByText("sold")).toBeInTheDocument();
  expect(screen.getByText("+5")).toBeInTheDocument();
  expect(screen.getByText("-2")).toBeInTheDocument();
});
