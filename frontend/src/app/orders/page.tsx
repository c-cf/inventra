"use client";

import Link from "next/link";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { OrderTable } from "@/components/OrderTable";
import { PageStatus } from "@/components/PageStatus";
import { ApiError, fetchOrders, ORDER_STATUSES } from "@/lib/api";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

export default function OrdersPage() {
  const { state, setData, signOut } = useAuthedLoad((token) => fetchOrders(token));
  const [statusFilter, setStatusFilter] = useState("");
  const [filterError, setFilterError] = useState("");
  const [filtering, setFiltering] = useState(false);

  async function handleFilter(value: string) {
    if (state.status !== "ready") return;
    const previous = statusFilter;
    setStatusFilter(value);
    setFilterError("");
    // One request at a time (the select is disabled meanwhile), so responses cannot race.
    setFiltering(true);
    try {
      const status = ORDER_STATUSES.find((candidate) => candidate === value);
      const orders = await fetchOrders(state.token, status);
      setData(() => orders);
    } catch (error) {
      setStatusFilter(previous);
      if (error instanceof ApiError && error.status === 401) {
        signOut();
        return;
      }
      setFilterError(error instanceof Error ? error.message : "Failed to load orders.");
    } finally {
      setFiltering(false);
    }
  }

  if (state.status === "loading") return <PageStatus message="Loading orders..." />;
  if (state.status === "error") return <PageStatus message={state.message} error />;

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-sm text-zinc-500">Place orders and move them through fulfilment.</p>
          </div>
          <Link
            href="/orders/new"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            New order
          </Link>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="order-status-filter" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              id="order-status-filter"
              value={statusFilter}
              disabled={filtering}
              onChange={(event) => void handleFilter(event.target.value)}
              className="w-44 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <p className="pb-2 text-sm text-zinc-500">{state.data.length} orders</p>
        </div>

        {filterError && (
          <p role="alert" className="text-sm text-red-600">
            {filterError}
          </p>
        )}

        <OrderTable orders={state.data} />
      </main>
    </div>
  );
}
