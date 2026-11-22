
"use client";

import { type FormEvent, useRef, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PageStatus } from "@/components/PageStatus";
import { ProductForm } from "@/components/ProductForm";
import { ProductTable } from "@/components/ProductTable";
import { StockAdjustmentForm } from "@/components/StockAdjustmentForm";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { ApiError, fetchProducts, type Product, type ProductQuery } from "@/lib/api";
import { loadForLatest } from "@/lib/loadForLatest";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

type Filters = { below: number | null; q: string };

const NO_FILTERS: Filters = { below: null, q: "" };

/** Mirrors the API: quantity under the threshold and name or SKU containing q. */
function matchesFilter(product: Product, { below, q }: Filters): boolean {
  if (below !== null && product.quantity >= below) return false;
  const needle = q.toLowerCase();
  return (
    needle === "" ||
    product.name.toLowerCase().includes(needle) ||
    product.sku.toLowerCase().includes(needle)
  );
}

function toQuery({ below, q }: Filters): ProductQuery {
  return { ...(below !== null && { below }), ...(q !== "" && { q }) };
}

export default function ProductsPage() {
  // The filters that last went through. Responses (create, adjust, the reload below) can
  // land after they changed, so those read this rather than a render's `active`.
  const activeRef = useRef<Filters>(NO_FILTERS);

  // Next keeps this page mounted while hidden and reloads it when the user comes back.
  // Reload with the applied filters, and again if they changed while the request was out,
  // so the list never falls back to an older search or threshold (#35).
  const {
    state,
    setData: setProducts,
    signOut: handleUnauthorized,
  } = useAuthedLoad(() => loadForLatest(activeRef, (filters) => fetchProducts(toQuery(filters))));

  const [threshold, setThreshold] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterLoading, setFilterLoading] = useState(false);
  const [active, setActive] = useState<Filters>(NO_FILTERS);
  const [movementsVersion, setMovementsVersion] = useState(0);

  function handleCreated(product: Product) {
    if (!matchesFilter(product, activeRef.current)) return;

    setProducts((products) => [...products, product]);
  }

  function handleAdjusted(product: Product) {
    setMovementsVersion((version) => version + 1);
    setProducts((products) =>
      products
        .map((item) => (item.id === product.id ? product : item))
        .filter((item) => matchesFilter(item, activeRef.current)),
    );
  }

  /** Reload the list for `next`; true when it worked. */
  async function applyFilters(next: Filters): Promise<boolean> {
    if (state.status !== "ready") return false;

    setFilterError("");
    setFilterLoading(true);

    try {
      const products = await fetchProducts(toQuery(next));

      setProducts(() => products);
      activeRef.current = next;
      setActive(next);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return false;
      }

      setFilterError(
        error instanceof Error
          ? error.message
          : "Failed to load products.",
      );
      return false;
    } finally {
      setFilterLoading(false);
    }
  }

  async function handleFilter() {
    const value = Number(threshold);

    if (
      threshold.trim() === "" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      setFilterError("Enter a non-negative integer threshold.");
      return;
    }

    await applyFilters({ ...active, below: value });
  }

  async function handleClearFilter() {
    if (await applyFilters({ ...active, below: null })) setThreshold("");
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await applyFilters({ ...active, q: searchText.trim() });
  }

  async function handleClearSearch() {
    if (await applyFilters({ ...active, q: "" })) setSearchText("");
  }

  if (state.status === "loading") return <PageStatus message="Loading products..." />;
  if (state.status === "error") return <PageStatus message={state.message} error />;

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-zinc-500">
            Manage products and inventory.
          </p>
        </div>

        {/* Product Creation */}
        <ProductForm
          onCreated={handleCreated}
          onUnauthorized={handleUnauthorized}
        />

        {/* Search and Low Stock Filter */}
        <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            Find Products
          </h2>

          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label htmlFor="product-search" className="mb-1 block text-sm font-medium">
                Search products
              </label>
              <input
                id="product-search"
                type="search"
                placeholder="Name or SKU"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={filterLoading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Search
            </button>

            <button
              type="button"
              onClick={handleClearSearch}
              disabled={filterLoading}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Clear search
            </button>
          </form>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="low-stock-threshold"
                className="mb-1 block text-sm font-medium"
              >
                Low stock threshold
              </label>

              <input
                id="low-stock-threshold"
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(event) =>
                  setThreshold(event.target.value)
                }
                className="w-44 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <button
              type="button"
              onClick={handleFilter}
              disabled={filterLoading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Filter
            </button>

            <button
              type="button"
              onClick={handleClearFilter}
              disabled={filterLoading}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Clear Filter
            </button>
          </div>

          {filterError && (
            <p role="alert" className="text-sm text-red-600">
              {filterError}
            </p>
          )}
        </section>

        {/* Stock Adjustment */}
        <StockAdjustmentForm
          products={state.data}
          onAdjusted={handleAdjusted}
          onUnauthorized={handleUnauthorized}
        />

        <StockMovementHistory
          products={state.data}
          onUnauthorized={handleUnauthorized}
          refreshKey={movementsVersion}
        />

        {/* Product List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Product List</h2>

            <p className="text-sm text-zinc-500">
              {state.data.length} items
            </p>
          </div>

          <ProductTable products={state.data} />
        </section>
      </main>
    </div>
  );
}
