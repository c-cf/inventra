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

  function handleCreated(product: Product) {
    setState((prev) =>
      prev.status === "ready" ? { ...prev, products: [...prev.products, product] } : prev,
    );
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
        if (!cancelled) setState({ status: "ready", user, products, token });
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
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <AppHeader user={state.status === "ready" ? state.user : null} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
            <p className="text-sm text-zinc-500">Stock on hand across the catalogue.</p>
          </div>
          {state.status === "ready" && (
            <p className="text-sm text-zinc-500">{state.products.length} items</p>
          )}
          
        </div>

        {state.status === "loading" && <p className="text-sm text-zinc-500">Loading…</p>}
        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {state.message}
          </p>
        )}
        {state.status === "ready" && (<ProductForm token={state.token} onCreated={handleCreated} />)}
        {state.status === "ready" && <ProductTable products={state.products} />}
      </main>
    </>
  );
}
