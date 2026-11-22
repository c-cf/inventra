import Link from "next/link";

import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { Order } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type OrderTableProps = {
  orders: Order[];
};

function itemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function OrderTable({ orders }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No orders yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th scope="col" className="px-4 py-3">Order</th>
            <th scope="col" className="px-4 py-3">Customer</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3 text-right">Items</th>
            <th scope="col" className="px-4 py-3 text-right">Total</th>
            <th scope="col" className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/orders/${order.id}`}
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  #{order.id}
                </Link>
              </td>
              <td className="px-4 py-3">{order.customer_name}</td>
              <td className="px-4 py-3">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{itemCount(order)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(order.total)}</td>
              <td className="px-4 py-3 text-zinc-500">{order.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
