"use client";

import { useState } from "react";

import { ApiError, type Order, type OrderStatus, updateOrderStatus } from "@/lib/api";

type OrderStatusActionsProps = {
  token: string;
  order: Order;
  onChanged: (order: Order) => void;
  onUnauthorized: () => void;
};

type Action = { label: string; target: OrderStatus };

// Mirrors the API's transitions: pending -> paid -> shipped, cancel before shipping.
const ACTIONS: Record<OrderStatus, Action[]> = {
  pending: [
    { label: "Mark as paid", target: "paid" },
    { label: "Cancel order", target: "cancelled" },
  ],
  paid: [
    { label: "Mark as shipped", target: "shipped" },
    { label: "Cancel order", target: "cancelled" },
  ],
  shipped: [],
  cancelled: [],
};

export function OrderStatusActions({
  token,
  order,
  onChanged,
  onUnauthorized,
}: Readonly<OrderStatusActionsProps>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = ACTIONS[order.status];

  async function run(action: Action) {
    if (
      action.target === "cancelled" &&
      !window.confirm(
        `Cancel order #${order.id}? Its items go back into stock and this cannot be undone.`,
      )
    ) {
      return;
    }

    setError(null);
    setPending(true);
    try {
      onChanged(await updateOrderStatus(token, order.id, action.target));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
    } finally {
      setPending(false);
    }
  }

  if (actions.length === 0) {
    return <p className="text-sm text-zinc-500">No further status changes.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            key={action.target}
            type="button"
            disabled={pending}
            onClick={() => void run(action)}
            className={
              action.target === "cancelled"
                ? "rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                : "rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            }
          >
            {action.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
