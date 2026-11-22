
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { AppHeader } from "@/components/AppHeader";
import { ProductForm } from "@/components/ProductForm";
import { ProductTable } from "@/components/ProductTable";
import { StockAdjustmentForm } from "@/components/StockAdjustmentForm";

import {
  ApiError,
  fetchMe,
  fetchProducts,
  type Product,
  type User,
} from "@/lib/api";

import { clearToken, getToken } from "@/lib/auth";

/** Whether a product belongs in the list while a low-stock filter is active. */
function matchesFilter(product: Product, below: number | null): boolean {
  return below === null || product.quantity < below;
}

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      user: User;
      products: Product[];
      token: string;
    };

export default function ProductsPage() {
  const router = useRouter();

  const [state, setState] = useState<PageState>({
    status: "loading",
  });

  const [threshold, setThreshold] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterLoading, setFilterLoading] = useState(false);
  const [activeBelow, setActiveBelow] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [user, products] = await Promise.all([
          fetchMe(token!),
          fetchProducts(token!),
        ]);

        if (cancelled) return;

        setState({
          status: "ready",
          user,
          products,
          token: token!,
        });
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && error.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load products.",
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleUnauthorized() {
    clearToken();
    router.replace("/login");
  }

  function handleCreated(product: Product) {
    if (!matchesFilter(product, activeBelow)) return;

    setState((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            products: [...prev.products, product],
          }
        : prev,
    );
  }

  function handleAdjusted(product: Product) {
    setState((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            products: prev.products
              .map((item) => (item.id === product.id ? product : item))
              .filter((item) => matchesFilter(item, activeBelow)),
          }
        : prev,
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
      const products = await fetchProducts(state.token, value);

      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, products }
          : prev,
      );
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

      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, products }
          : prev,
      );
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

  if (state.status === "loading") {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-5xl p-6">
          <p>Loading products...</p>
        </main>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-5xl p-6">
          <p role="alert">{state.message}</p>
        </main>
      </div>
    );
  }

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
          products={state.products}
          onAdjusted={handleAdjusted}
          onUnauthorized={handleUnauthorized}
        />

        <StockMovementHistory
          token={state.token}
          products={state.products}
          onUnauthorized={handleUnauthorized}
        />

        {/* Product List */}
        {/* Product List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Product List</h2>

            <p className="text-sm text-zinc-500">
              {state.products.length} items
            </p>
          </div>

          <ProductTable products={state.products} />
        </section>
      </main>
    </div>
  );
}
