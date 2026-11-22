"use client";

import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { OrderForm } from "@/components/OrderForm";
import { PageStatus } from "@/components/PageStatus";
import { fetchProducts } from "@/lib/api";
import { useAuthedLoad } from "@/lib/useAuthedLoad";

export default function NewOrderPage() {
  const router = useRouter();
  const { state, setData, signOut } = useAuthedLoad(() => fetchProducts());

  // Someone else changed the stock between loading the form and placing the order:
  // show the current numbers so the user can fix the quantities.
  function reloadStock() {
    fetchProducts().then(
      (products) => setData(() => products),
      () => {}, // the order's own error message is already on screen
    );
  }

  if (state.status === "loading") return <PageStatus message="Loading products..." />;
  if (state.status === "error") return <PageStatus message={state.message} error />;

  return (
    <div className="min-h-screen">
      <AppHeader user={state.user} />

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: "New order" }]} />
        <h1 className="text-2xl font-bold">New order</h1>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <OrderForm
            products={state.data}
            onCreated={(order) => router.push(`/orders/${order.id}`)}
            onUnauthorized={signOut}
            onStockConflict={reloadStock}
          />
        </section>
      </main>
    </div>
  );
}
