import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductsPage from "@/app/products/page";
import { ApiError, createProduct, fetchMe, fetchProducts, type Product } from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  createProduct: vi.fn(),
  fetchStockMovements: vi.fn(),
}));

function product(id: number, sku: string, name: string, quantity = 10): Product {
  return { id, sku, name, price: 10, quantity, created_at: "2026-01-01" };
}

const keyboard = product(1, "KB-001", "Mechanical Keyboard", 3);
const mouse = product(2, "MS-001", "Wireless Mouse");

async function renderPage() {
  vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard, mouse]);
  render(<ProductsPage />);
  await screen.findByRole("link", { name: "MS-001" });
  return userEvent.setup();
}

async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText("Search products"), text);
  await user.click(screen.getByRole("button", { name: "Search" }));
}

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchProducts).mockReset();
  vi.mocked(createProduct).mockReset();
});

describe("ProductsPage search", () => {
  it("searches products by name or SKU", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard]);

    await search(user, "key");

    await waitFor(() => expect(screen.queryByRole("link", { name: "MS-001" })).not.toBeInTheDocument());
    expect(fetchProducts).toHaveBeenLastCalledWith({ q: "key" });
  });

  it("keeps the search when the low-stock filter is applied", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard]).mockResolvedValueOnce([keyboard]);

    await search(user, "key");
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
    await user.type(screen.getByLabelText("Low stock threshold"), "5");
    await user.click(screen.getByRole("button", { name: "Filter" }));

    await waitFor(() => expect(fetchProducts).toHaveBeenLastCalledWith({ below: 5, q: "key" }));
  });

  it("clearing the search keeps the low-stock filter", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts)
      .mockResolvedValueOnce([keyboard])
      .mockResolvedValueOnce([keyboard])
      .mockResolvedValueOnce([keyboard]);

    await user.type(screen.getByLabelText("Low stock threshold"), "5");
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await search(user, "key");
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => expect(fetchProducts).toHaveBeenLastCalledWith({ below: 5 }));
    expect(screen.getByLabelText("Search products")).toHaveValue("");
  });

  it("does not add a created product that does not match the search", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard]);
    vi.mocked(createProduct).mockResolvedValue(product(3, "HB-001", "USB Hub"));

    await search(user, "key");
    await waitFor(() => expect(screen.queryByRole("link", { name: "MS-001" })).not.toBeInTheDocument());
    await user.type(screen.getByLabelText(/^sku$/i), "HB-001");
    await user.type(screen.getByLabelText(/^name$/i), "USB Hub");
    await user.type(screen.getByLabelText(/^price$/i), "10");
    await user.click(screen.getByRole("button", { name: /add product/i }));
    await waitFor(() => expect(createProduct).toHaveBeenCalled());

    expect(within(screen.getByRole("table")).queryByText("USB Hub")).not.toBeInTheDocument();
  });

  it("shows the backend's message when the search fails", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError(500, "Database unavailable"));

    await search(user, "key");

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  });

  it("signs the user out when the search is rejected with 401", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockRejectedValueOnce(new ApiError(401, "Not authenticated"));

    await search(user, "key");

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });
});

describe("ProductsPage search with a slow create", () => {
  it("checks a product created mid-search against the search that is active when it lands", async () => {
    const user = await renderPage();
    let finishCreate: (created: Product) => void = () => {};
    vi.mocked(createProduct).mockReturnValue(new Promise((done) => (finishCreate = done)));
    vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard]);

    await user.type(screen.getByLabelText(/^sku$/i), "HB-001");
    await user.type(screen.getByLabelText(/^name$/i), "USB Hub");
    await user.type(screen.getByLabelText(/^price$/i), "10");
    await user.click(screen.getByRole("button", { name: /add product/i }));
    await search(user, "key");
    await waitFor(() => expect(screen.queryByRole("link", { name: "MS-001" })).not.toBeInTheDocument());
    finishCreate(product(3, "HB-001", "USB Hub"));
    await waitFor(() => expect(screen.getByLabelText(/^sku$/i)).toHaveValue(""));

    expect(within(screen.getByRole("table")).queryByText("USB Hub")).not.toBeInTheDocument();
  });

  it("matches the search regardless of letter case", async () => {
    const user = await renderPage();
    vi.mocked(fetchProducts).mockResolvedValueOnce([keyboard]);
    vi.mocked(createProduct).mockResolvedValue(product(3, "kb-009", "Travel KEYBOARD"));

    await search(user, "Keyboard");
    await waitFor(() => expect(screen.queryByRole("link", { name: "MS-001" })).not.toBeInTheDocument());
    await user.type(screen.getByLabelText(/^sku$/i), "kb-009");
    await user.type(screen.getByLabelText(/^name$/i), "Travel KEYBOARD");
    await user.type(screen.getByLabelText(/^price$/i), "10");
    await user.click(screen.getByRole("button", { name: /add product/i }));

    expect(await within(screen.getByRole("table")).findByText("Travel KEYBOARD")).toBeInTheDocument();
  });
});
