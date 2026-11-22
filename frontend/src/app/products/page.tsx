
"use client";

import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PageStatus } from "@/components/PageStatus";
import { ProductForm } from "@/components/ProductForm";
import { ProductTable } from "@/components/ProductTable";
import { StockAdjustmentForm } from "@/components/StockAdjustmentForm";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { ApiError, fetchProducts, type Product } from "@/lib/api";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

/** Whether a product belongs in the list while a low-stock filter is active. */
function matchesFilter(product: Product, below: number | null): boolean {
  return below === null || product.quantity < below;
}

export default function ProductsPage() {
  const {
    state,
    setData: setProducts,
    signOut: handleUnauthorized,
  } = useAuthedLoad((token) => fetchProducts(token));

  const [threshold, setThreshold] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterLoading, setFilterLoading] = useState(false);
  const [activeBelow, setActiveBelow] = useState<number | null>(null);
  const [movementsVersion, setMovementsVersion] = useState(0);

  function handleCreated(product: Product) {
    if (!matchesFilter(product, activeBelow)) return;

    setProducts((products) => [...products, product]);
  }

  function handleAdjusted(product: Product) {
    setMovementsVersion((version) => version + 1);
    setProducts((products) =>
      products
        .map((item) => (item.id === product.id ? product : item))
        .filter((item) => matchesFilter(item, activeBelow)),
    );
  }

  async function handleFilter() {
    if (state.status !== "ready") return;

    const value = Number(threshold);

    if (
      threshold.trim() === "" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      setFilterError("Enter a non-negative integer threshold.");
      return;
    }

    setFilterError("");
    setFilterLoading(true);

    try {
      const products = await fetchProducts(state.token, { below: value });

      setProducts(() => products);
      setActiveBelow(value);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }

      setFilterError(
        error instanceof Error
          ? error.message
          : "Failed to filter products.",
      );
    } finally {
      setFilterLoading(false);
    }
  }

  async function handleClearFilter() {
    if (state.status !== "ready") return;

    setFilterError("");
    setFilterLoading(true);

    try {
      const products = await fetchProducts(state.token);

      setProducts(() => products);
      setActiveBelow(null);

      setThreshold("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }

      setFilterError(
        error instanceof Error
          ? error.message
          : "Failed to load products.",
      );
    } finally {
      setFilterLoading(false);
    }
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
          token={state.token}
          onCreated={handleCreated}
          onUnauthorized={handleUnauthorized}
        />

        {/* Low Stock Filter */}
        <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            Low Stock Filter
          </h2>

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
          token={state.token}
          products={state.data}
          onAdjusted={handleAdjusted}
          onUnauthorized={handleUnauthorized}
        />

        <StockMovementHistory
          token={state.token}
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
