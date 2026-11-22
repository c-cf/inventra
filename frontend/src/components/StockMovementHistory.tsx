"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  ApiError,
  fetchStockMovements,
  type Product,
  type StockMovement,
} from "@/lib/api";

type Props = {
  products: Product[];
  onUnauthorized: () => void;
  /** Bump this after stock changes so the history on screen is fetched again. */
  refreshKey?: number;
};

export function StockMovementHistory({
  products,
  onUnauthorized,
  refreshKey = 0,
}: Props) {
  const [productId, setProductId] = useState("");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  // A selection only counts while the product is still listed (a filter or an
  // adjustment can remove it); otherwise the select shows the placeholder.
  const selectedId = products.some((product) => String(product.id) === productId)
    ? productId
    : "";
  const showHistory = selectedId !== "";
  // The product whose history is on screen; refreshes re-fetch it.
  const viewedId = useRef<number | null>(null);
  // Responses that arrive after a newer request (or a selection change) are dropped.
  const latestRequest = useRef(0);

  function handleLoadError(err: unknown) {
    setMovements([]);
    setSearched(false);

    if (err instanceof ApiError && err.status === 401) {
      onUnauthorized();
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Failed to load stock movements.",
    );
  }

  async function handleViewMovements() {
    if (!selectedId) {
      setError("Please select a product.");
      return;
    }

    const id = Number(selectedId);
    const request = ++latestRequest.current;
    // Set before the request so a refresh that lands mid-flight re-fetches this product.
    viewedId.current = id;

    setError("");
    setLoading(true);
    setSearched(false);

    try {
      const result = await fetchStockMovements(id);
      if (request !== latestRequest.current) return;

      setMovements(result);
      setSearched(true);
    } catch (err) {
      if (request === latestRequest.current) handleLoadError(err);
    } finally {
      setLoading(false);
    }
  }

  const onRefreshError = useEffectEvent(handleLoadError);

  useEffect(() => {
    const id = viewedId.current;
    if (refreshKey === 0 || id === null) return;

    const request = ++latestRequest.current;

    fetchStockMovements(id).then(
      (result) => {
        if (request !== latestRequest.current) return;
        setMovements(result);
        setError("");
        setSearched(true);
      },
      (err: unknown) => {
        if (request === latestRequest.current) onRefreshError(err);
      },
    );
  }, [refreshKey]);

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">
        Stock Movement History
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="movement-product"
            className="mb-1 block text-sm font-medium"
          >
            Movement product
          </label>

          <select
            id="movement-product"
            value={selectedId}
            onChange={(event) => {
              latestRequest.current += 1;
              setProductId(event.target.value);
              setMovements([]);
              viewedId.current = null;
              setSearched(false);
              setError("");
            }}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select a product</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleViewMovements}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Loading..." : "View Movements"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {showHistory && searched && movements.length === 0 && (
        <p className="text-sm text-zinc-500">
          No stock movements found.
        </p>
      )}

      {showHistory && movements.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="px-4 py-3 tabular-nums">
                    {movement.change > 0
                      ? `+${movement.change}`
                      : movement.change}
                  </td>

                  <td className="px-4 py-3">
                    {movement.reason}
                  </td>

                  <td className="px-4 py-3">
                    {movement.created_at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
