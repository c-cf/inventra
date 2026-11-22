"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageStatus } from "@/components/PageStatus";
import { ProductEditForm } from "@/components/ProductEditForm";
import { ApiError, deleteProduct, fetchProduct } from "@/lib/api";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import { parsePositiveId } from "@/lib/routeParams";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

export function ProductDetail() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = parsePositiveId(params.id);
  const { state, setData, signOut } = useAuthedLoad(() =>
    productId === null
      ? Promise.reject(new ApiError(404, "Product not found"))
      : fetchProduct(productId),
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (state.status === "loading") return <PageStatus message="Loading product..." />;
  if (state.status === "error") {
    return (
      <PageStatus message={state.message} error>
        <Link href="/products" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Back to products
        </Link>
      </PageStatus>
    );
  }

  const product = state.data;

  async function handleDelete() {
    if (state.status !== "ready") return;
    if (!window.confirm(`Delete ${product.sku} and its stock history? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      router.push("/products");
    } catch (err) {
      setDeleting(false);
      if (err instanceof ApiError && err.status === 401) {
        signOut();
        return;
      }
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <Breadcrumbs items={[{ label: "Products", href: "/products" }, { label: product.sku }]} />

        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-zinc-500">
            <span className="text-zinc-900 dark:text-zinc-100">{product.quantity} in stock</span> ·{" "}
            {formatCurrency(product.price)} · added {formatTimestamp(product.created_at)}
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Edit product</h2>
          <ProductEditForm
            product={product}
            onSaved={(saved) => setData(() => saved)}
            onUnauthorized={signOut}
          />
        </section>

        {state.user.role === "admin" && (
        <section className="space-y-3 rounded-lg border border-red-200 p-6 dark:border-red-900">
          <h2 className="text-lg font-semibold">Delete product</h2>
          <p className="text-sm text-zinc-500">
            Removes the product and its stock history. Products that appear on an order cannot be
            deleted.
          </p>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          >
            {deleting ? "Deleting…" : "Delete product"}
          </button>
          {deleteError && (
            <p role="alert" className="text-sm text-red-600">
              {deleteError}
            </p>
          )}
        </section>
        )}
      </main>
    </div>
  );
}
