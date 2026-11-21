
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { ProductForm } from "@/components/ProductForm";
import { ProductTable } from "@/components/ProductTable";
import { ApiError, fetchMe, fetchProducts, type Product, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

type PageState =
  | { status: "loading" }
  | { status: "ready"; user: User; products: Product[]; token: string }
  | { status: "error"; message: string };

export default function ProductsPage() {
  const router = useRouter();

  const [state, setState] = useState<PageState>({ status: "loading" });
  const [threshold, setThreshold] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filterLoading, setFilterLoading] = useState(false);

  function handleCreated(product: Product) {
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, products: [...prev.products, product] }
        : prev,
    );
  }

  function handleUnauthorized() {
    clearToken();
    router.replace("/login");
  }

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    Promise.all([fetchMe(token), fetchProducts(token)])
      .then(([user, products]) => {
        if (!cancelled) {
          setState({
            status: "ready",
            user,
            products,
            token,
          });
        }
      })
      .catch((error: unknown) => {
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
              : "Something went wrong.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleFilter() {
    if (state.status !== "ready") return;

    const below = Number(threshold);

    if (
      threshold.trim() === "" ||
      !Number.isInteger(below) ||
      below < 0
    ) {
      setFilterError("Enter a non-negative integer.");
      return;
    }

    setFilterError("");
    setFilterLoading(true);

    try {
      const products = await fetchProducts(state.token, below);

      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, products }
          : prev,
      );
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

    setThreshold("");
    setFilterError("");
    setFilterLoading(true);

    try {
      const products = await fetchProducts(state.token);

      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, products }
          : prev,
      );
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

  return (
    <>
      <AppHeader
        user={state.status === "ready" ? state.user : null}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Products
            </h1>

            <p className="text-sm text-zinc-500">
              Stock on hand across the catalogue.
            </p>
          </div>

          {state.status === "ready" && (
            <p className="text-sm text-zinc-500">
              {state.products.length} items
            </p>
          )}
        </div>

        {state.status === "loading" && (
          <p className="text-sm text-zinc-500">
            Loading…
          </p>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {state.message}
          </p>
        )}

        {state.status === "ready" && (
          <>
            {/* Existing product creation form */}
            <ProductForm
              token={state.token}
              onCreated={handleCreated}
              onUnauthorized={handleUnauthorized}
            />

            {/* Inventory: Low stock filter */}
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

            {/* Existing product table */}
            <ProductTable products={state.products} />
          </>
        )}
      </main>
    </>
  );
}
