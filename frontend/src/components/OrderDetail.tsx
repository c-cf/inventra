"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { OrderStatusActions } from "@/components/OrderStatusActions";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { PageStatus } from "@/components/PageStatus";
import { ApiError, fetchOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { parsePositiveId } from "@/lib/routeParams";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

export function OrderDetail() {
  const params = useParams<{ id: string }>();
  const orderId = parsePositiveId(params.id);
  const { state, setData, signOut } = useAuthedLoad(() =>
    orderId === null
      ? Promise.reject(new ApiError(404, "Order not found"))
      : fetchOrder(orderId),
  );

  if (state.status === "loading") return <PageStatus message="Loading order..." />;
  if (state.status === "error") {
    return (
      <PageStatus message={state.message} error>
        <Link href="/orders" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Back to orders
        </Link>
      </PageStatus>
    );
  }

  const order = state.data;

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: `Order #${order.id}` }]} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="flex items-center gap-3 text-2xl font-bold">
              Order #{order.id} <OrderStatusBadge status={order.status} />
            </h1>
            <p className="text-sm text-zinc-500">
              <span className="text-zinc-900 dark:text-zinc-100">{order.customer_name}</span> · placed{" "}
              {order.created_at}
            </p>
          </div>
          <OrderStatusActions
            order={order}
            onChanged={(updated) => setData(() => updated)}
            onUnauthorized={signOut}
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th scope="col" className="px-4 py-3">SKU</th>
                <th scope="col" className="px-4 py-3">Product</th>
                <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                <th scope="col" className="px-4 py-3 text-right">Unit price</th>
                <th scope="col" className="px-4 py-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {order.items.map((item) => (
                <tr key={item.product_id}>
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-right text-lg font-semibold">
          Total <span className="tabular-nums">{formatCurrency(order.total)}</span>
        </p>
      </main>
    </div>
  );
}
