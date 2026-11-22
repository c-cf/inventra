"use client";

import { type FormEvent, useLayoutEffect, useRef, useState } from "react";

import { ApiError, createOrder, type Order, type Product } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type OrderFormProps = {
  products: Product[];
  onCreated: (order: Order) => void;
  onUnauthorized: () => void;
  /** Called when the API refuses the order because stock changed meanwhile (409). */
  onStockConflict?: () => void;
};

type Line = { key: number; productId: string; quantity: string };

const EMPTY_LINES: Line[] = [{ key: 1, productId: "", quantity: "1" }];

const MAX_CUSTOMER_LENGTH = 200; // OrderCreate.customer_name max_length in the API

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function lineTotal(line: Line, products: Product[]): number {
  const product = products.find((p) => String(p.id) === line.productId);
  const quantity = Number(line.quantity);
  if (!product || !Number.isInteger(quantity) || quantity <= 0) return 0;
  return product.price * quantity;
}

/** Mirrors the API's rules so most mistakes never leave the browser. */
function validate(customer: string, lines: Line[], products: Product[]): string | null {
  if (customer.trim() === "") return "Customer is required.";
  if (customer.trim().length > MAX_CUSTOMER_LENGTH) {
    return `Customer must be ${MAX_CUSTOMER_LENGTH} characters or fewer.`;
  }
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    const product = products.find((p) => String(p.id) === line.productId);
    if (!product) return `Choose a product for line ${n}.`;
    if (seen.has(line.productId)) return `${product.sku} is on more than one line.`;
    seen.add(line.productId);
    const quantity = Number(line.quantity);
    if (line.quantity.trim() === "" || !Number.isInteger(quantity) || quantity <= 0) {
      return `Quantity for line ${n} must be a whole number of 1 or more.`;
    }
    if (quantity > product.quantity) {
      return `Only ${product.quantity} of ${product.sku} in stock.`;
    }
  }
  return null;
}

export function OrderForm({
  products,
  onCreated,
  onUnauthorized,
  onStockConflict,
}: Readonly<OrderFormProps>) {
  const [customer, setCustomer] = useState("");
  const [lines, setLines] = useState<Line[]>(EMPTY_LINES);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set synchronously so even a double click in one frame posts a single order.
  const submitting = useRef(false);
  // Set after a successful order: the form stays locked until the page is left.
  const placedOrder = useRef(false);

  // Next.js keeps this page mounted (hidden) after navigating to the new order, and
  // shows it again on the way back. Start the next order from a clean, unlocked form;
  // an unsent draft is left alone. (Cleanup runs when the page is hidden.)
  useLayoutEffect(() => {
    return () => {
      if (!placedOrder.current) return;
      placedOrder.current = false;
      submitting.current = false;
      setPending(false);
      setCustomer("");
      setLines(EMPTY_LINES);
      setError(null);
    };
  }, []);

  const total = lines.reduce((sum, line) => sum + lineTotal(line, products), 0);

  function addLine() {
    setLines((current) => [
      ...current,
      { key: Math.max(...current.map((line) => line.key)) + 1, productId: "", quantity: "1" },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function updateLine(key: number, changes: Partial<Omit<Line, "key">>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const problem = validate(customer, lines, products);
    setError(problem);
    if (problem) return;

    submitting.current = true;
    setPending(true);
    let placed = false;
    try {
      const order = await createOrder({
        customer_name: customer.trim(),
        items: lines.map((line) => ({
          product_id: Number(line.productId),
          quantity: Number(line.quantity),
        })),
      });
      placed = true;
      placedOrder.current = true;
      onCreated(order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      if (err instanceof ApiError && err.status === 409) onStockConflict?.();
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
    } finally {
      // After a success the page navigates away; keep the form locked until it does.
      if (!placed) {
        submitting.current = false;
        setPending(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="order-customer" className="block text-sm font-medium">
          Customer
        </label>
        <input
          id="order-customer"
          className={inputClass}
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />
      </div>

      {lines.map((line, index) => {
        const n = index + 1;
        return (
          <div key={line.key} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <div className="space-y-1">
              <label htmlFor={`order-product-${line.key}`} className="block text-sm font-medium">
                Product {n}
              </label>
              <select
                id={`order-product-${line.key}`}
                className={inputClass}
                value={line.productId}
                onChange={(e) => updateLine(line.key, { productId: e.target.value })}
              >
                <option value="">Select a product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id} disabled={product.quantity === 0}>
                    {product.name} ({product.sku}) · {product.quantity} in stock
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`order-quantity-${line.key}`} className="block text-sm font-medium">
                Quantity {n}
              </label>
              <input
                id={`order-quantity-${line.key}`}
                type="number"
                min="1"
                step="1"
                className={inputClass}
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
              />
            </div>
            {lines.length > 1 ? (
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                aria-label={`Remove line ${n}`}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Remove
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Add line
      </button>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tabular-nums">Total: {formatCurrency(total)}</p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Placing…" : "Place order"}
        </button>
      </div>
    </form>
  );
}
