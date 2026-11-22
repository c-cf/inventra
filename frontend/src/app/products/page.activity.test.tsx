import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductsPage from "@/app/products/page";
import { fetchMe, fetchProducts, type Product, type ProductQuery } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  fetchStockMovements: vi.fn(),
}));

function product(id: number, sku: string, name: string, quantity: number): Product {
  return { id, sku, name, price: 10, quantity, created_at: "2026-01-01" };
}

const keyboard = product(1, "KB-001", "Mechanical Keyboard", 25);
const mouse = product(2, "MS-001", "Wireless Mouse", 37);
const monitor = product(3, "MN-027", "27-inch Monitor", 6);
const catalog = [keyboard, mouse, monitor];

/** Answers like the API: quantity under `below` and name or SKU containing `q`. */
async function serveProducts({ below, q = "" }: ProductQuery = {}): Promise<Product[]> {
  const needle = q.toLowerCase();
  return catalog.filter(
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
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchProducts).mockReset().mockImplementation(serveProducts);
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
});
