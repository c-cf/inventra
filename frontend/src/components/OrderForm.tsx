"use client";

import { type FormEvent, useState } from "react";

import { createOrder, type Order, type Product } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type OrderFormProps = {
  token: string;
  products: Product[];
  onCreated: (order: Order) => void;
  onUnauthorized: () => void;
};

type Line = { key: number; productId: string; quantity: string };

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
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    const product = products.find((p) => String(p.id) === line.productId);
    if (!product) return `Choose a product for line ${n}.`;
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

export function OrderForm({ token, products, onCreated }: Readonly<OrderFormProps>) {
  const [customer, setCustomer] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: "", quantity: "1" }]);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((sum, line) => sum + lineTotal(line, products), 0);

  function updateLine(key: number, changes: Partial<Omit<Line, "key">>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = validate(customer, lines, products);
    setError(problem);
    if (problem) return;

    const order = await createOrder(token, {
      customer_name: customer.trim(),
      items: lines.map((line) => ({
        product_id: Number(line.productId),
        quantity: Number(line.quantity),
      })),
    });
    onCreated(order);
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
          <div key={line.key} className="grid gap-3 sm:grid-cols-[1fr_8rem]">
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
          </div>
        );
      })}

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
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Place order
        </button>
      </div>
    </form>
  );
}
