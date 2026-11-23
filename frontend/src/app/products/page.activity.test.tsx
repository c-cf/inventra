import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductsPage from "@/app/products/page";
import {
  adjustStock,
  createProduct,
  fetchMe,
  fetchProducts,
  type Product,
  type ProductInput,
  type ProductQuery,
  type User,
} from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  fetchStockMovements: vi.fn(),
  createProduct: vi.fn(),
  adjustStock: vi.fn(),
}));

function product(id: number, sku: string, name: string, quantity: number): Product {
  return { id, sku, name, price: 10, quantity, created_at: "2026-01-01" };
}

const keyboard = product(1, "KB-001", "Mechanical Keyboard", 25);
const mouse = product(2, "MS-001", "Wireless Mouse", 37);
const monitor = product(3, "MN-027", "27-inch Monitor", 6);
const catalog = [keyboard, mouse, monitor];
let stock: Product[] = catalog; // what the API holds now; creates and adjustments change it

/** Answers like the API: quantity under `below` and name or SKU containing `q`. */
async function serveProducts({ below, q = "" }: ProductQuery = {}): Promise<Product[]> {
  const needle = q.toLowerCase();
  return stock.filter(
    (p) =>
      (below === undefined || p.quantity < below) &&
      (p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)),
  );
}

// Next.js (Cache Components) keeps a visited page mounted inside <Activity mode="hidden">
// and runs its effects again when the user comes back, which reloads the products.
function page(mode: "visible" | "hidden") {
  return (
    <Activity mode={mode}>
      <ProductsPage />
    </Activity>
  );
}

async function serveCreate({ sku, name, price, quantity }: ProductInput): Promise<Product> {
  const created = { id: stock.length + 1, sku, name, price, quantity, created_at: "2026-11-23" };
  stock = [...stock, created];
  return created;
}

async function serveAdjust(productId: number, change: number): Promise<Product> {
  stock = stock.map((p) => (p.id === productId ? { ...p, quantity: p.quantity + change } : p));
  return stock.find((p) => p.id === productId) as Product;
}

function quantityOf(sku: string): string {
  const row = screen.getByRole("link", { name: sku }).closest("tr") as HTMLElement;
  return within(row).getAllByRole("cell")[3].textContent ?? "";
}

function listedSkus(): string[] {
  return screen.queryAllByRole("link", { name: /^[A-Z]{2}-\d{3}$/ }).map((link) => link.textContent ?? "");
}

async function renderPage() {
  const view = render(page("visible"));
  await screen.findByRole("link", { name: "MS-001" });
  return { ...view, user: userEvent.setup() };
}

async function leaveAndComeBack(rerender: (ui: ReactNode) => void) {
  const loadsBefore = vi.mocked(fetchProducts).mock.calls.length;
  rerender(page("hidden"));
  rerender(page("visible"));
  await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(loadsBefore + 1));
}

beforeEach(() => {
  stock = catalog;
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchProducts).mockReset().mockImplementation(serveProducts);
  vi.mocked(createProduct).mockReset().mockImplementation(serveCreate);
  vi.mocked(adjustStock).mockReset().mockImplementation(serveAdjust);
});

describe("ProductsPage when the user comes back to it (#35)", () => {
  it("reloads with the search that was applied", async () => {
    const { rerender, user } = await renderPage();
    await user.type(screen.getByLabelText("Search products"), "mouse");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));

    await leaveAndComeBack(rerender);

    expect(fetchProducts).toHaveBeenLastCalledWith({ q: "mouse" });
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
    expect(screen.getByLabelText("Search products")).toHaveValue("mouse");
  });

  it("reloads with the low-stock threshold that was applied", async () => {
    const { rerender, user } = await renderPage();
    await user.type(screen.getByLabelText("Low stock threshold"), "10");
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await waitFor(() => expect(listedSkus()).toEqual(["MN-027"]));

    await leaveAndComeBack(rerender);

    expect(fetchProducts).toHaveBeenLastCalledWith({ below: 10 });
    await waitFor(() => expect(listedSkus()).toEqual(["MN-027"]));
  });

  it("reloads with the applied search, not text typed but never searched for", async () => {
    const { rerender, user } = await renderPage();
    await user.type(screen.getByLabelText("Search products"), "mouse");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
    await user.clear(screen.getByLabelText("Search products"));
    await user.type(screen.getByLabelText("Search products"), "key");

    await leaveAndComeBack(rerender);

    expect(fetchProducts).toHaveBeenLastCalledWith({ q: "mouse" });
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
  });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe("ProductsPage when filters change while the reload is on its way (#35)", () => {
  it("keeps a search cleared before the reload lands", async () => {
    const { rerender, user } = await renderPage();
    await user.type(screen.getByLabelText("Search products"), "mouse");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
    const reload = deferred<Product[]>();
    vi.mocked(fetchProducts).mockReturnValueOnce(reload.promise);

    await leaveAndComeBack(rerender);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => expect(listedSkus()).toEqual(["KB-001", "MS-001", "MN-027"]));
    await act(async () => reload.resolve([mouse])); // the reload for "mouse" lands last

    // It asks again for the cleared search (load, search, reload, clear, again), and the
    // list it ends on holds every product.
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(5));
    expect(fetchProducts).toHaveBeenLastCalledWith({});
    await waitFor(() => expect(listedSkus()).toEqual(["KB-001", "MS-001", "MN-027"]));
  });

  it("honours a search that was still on its way when the user left", async () => {
    const { rerender, user } = await renderPage();
    const search = deferred<Product[]>();
    const reload = deferred<Product[]>();
    vi.mocked(fetchProducts).mockReturnValueOnce(search.promise).mockReturnValueOnce(reload.promise);
    await user.type(screen.getByLabelText("Search products"), "mouse");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await leaveAndComeBack(rerender); // asks with the filters applied so far: none
    await act(async () => search.resolve([mouse]));
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
    await act(async () => reload.resolve(catalog)); // the unfiltered reload lands last

    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
    expect(fetchProducts).toHaveBeenLastCalledWith({ q: "mouse" });
  });

  it("keeps a search cleared after the reload's products but before its session check (#40)", async () => {
    const { rerender, user } = await renderPage();
    await user.type(screen.getByLabelText("Search products"), "mouse");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(listedSkus()).toEqual(["MS-001"]));
    const session = deferred<User>();
    vi.mocked(fetchMe).mockReturnValueOnce(session.promise);

    await leaveAndComeBack(rerender); // its products for "mouse" come back at once
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => expect(listedSkus()).toEqual(["KB-001", "MS-001", "MN-027"]));
    await act(async () => session.resolve({ id: 1, username: "alice", role: "admin" }));

    expect(listedSkus()).toEqual(["KB-001", "MS-001", "MN-027"]);
  });
});

describe("ProductsPage when the user changes the list while the reload is out (#43)", () => {
  it("keeps a product created before the reload lands", async () => {
    const { rerender, user } = await renderPage();
    const reload = deferred<Product[]>();
    vi.mocked(fetchProducts).mockReturnValueOnce(reload.promise);
    const answerFromBefore = await serveProducts();

    await leaveAndComeBack(rerender);
    await user.type(screen.getByLabelText(/^sku$/i), "HB-001");
    await user.type(screen.getByLabelText(/^name$/i), "USB Hub");
    await user.type(screen.getByLabelText(/^price$/i), "10");
    await user.click(screen.getByRole("button", { name: /add product/i }));
    await waitFor(() => expect(listedSkus()).toContain("HB-001"));
    await act(async () => reload.resolve(answerFromBefore)); // served before the create

    expect(listedSkus()).toContain("HB-001");
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(3)); // load, reload, again
    await waitFor(() => expect(listedSkus()).toEqual(["KB-001", "MS-001", "MN-027", "HB-001"]));
  });

  it("keeps a stock adjustment made before the reload lands", async () => {
    const { rerender, user } = await renderPage();
    const reload = deferred<Product[]>();
    vi.mocked(fetchProducts).mockReturnValueOnce(reload.promise);
    const answerFromBefore = await serveProducts();

    await leaveAndComeBack(rerender);
    await user.selectOptions(screen.getByLabelText("Adjust product"), "1");
    await user.type(screen.getByLabelText("Stock change"), "5");
    await user.type(screen.getByLabelText("Adjustment reason"), "restock");
    await user.click(screen.getByRole("button", { name: "Adjust Stock" }));
    await screen.findByText("Mechanical Keyboard now has 30 in stock.");
    await act(async () => reload.resolve(answerFromBefore)); // still says 25

    expect(quantityOf("KB-001")).toBe("30");
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(quantityOf("KB-001")).toBe("30"));
  });
});
