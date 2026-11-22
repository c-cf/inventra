"use client";

import { useState, type FormEvent } from "react";

import { adjustStock, ApiError, type Product } from "@/lib/api";

type Props = {
  products: Product[];
  onAdjusted: (product: Product) => void;
  onUnauthorized: () => void;
};

export function StockAdjustmentForm({
  products,
  onAdjusted,
  onUnauthorized,
}: Props) {
  const [productId, setProductId] = useState("");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A selection only counts while the product is still listed (a filter or an
  // adjustment can remove it); otherwise the select shows the placeholder.
  const selectedId = products.some((product) => String(product.id) === productId)
    ? productId
    : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(change);

    if (
      !selectedId ||
      change.trim() === "" ||
      !Number.isInteger(amount) ||
      amount === 0
    ) {
      setError("Select a product and enter a non-zero integer.");
      return;
    }

    if (!reason.trim()) {
      setError("Adjustment reason is required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const updated = await adjustStock(
        Number(selectedId),
        amount,
        reason.trim(),
      );

      onAdjusted(updated);
      setChange("");
      setReason("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Stock adjustment failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Stock Adjustment</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="adjust-product" className="mb-1 block text-sm">
            Adjust product
          </label>

          <select
            id="adjust-product"
            value={selectedId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full rounded-md border p-2 dark:bg-zinc-900"
          >
            <option value="">Select a product</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="stock-change" className="mb-1 block text-sm">
            Stock change
          </label>

          <input
            id="stock-change"
            type="number"
            step="1"
            value={change}
            onChange={(event) => setChange(event.target.value)}
            placeholder="e.g. 5 or -2"
            className="w-full rounded-md border p-2 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label htmlFor="adjustment-reason" className="mb-1 block text-sm">
            Adjustment reason
          </label>

          <input
            id="adjustment-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border p-2 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Adjusting..." : "Adjust Stock"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
