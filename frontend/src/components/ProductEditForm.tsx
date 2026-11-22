"use client";

import { type FormEvent, useState } from "react";

import { type Product, type ProductUpdate, updateProduct } from "@/lib/api";

type ProductEditFormProps = {
  token: string;
  product: Product;
  onSaved: (product: Product) => void;
  onUnauthorized: () => void;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/** The fields that differ from the product, trimmed. */
function changedFields(product: Product, sku: string, name: string, price: string): ProductUpdate {
  const changes: ProductUpdate = {};
  if (sku.trim() !== product.sku) changes.sku = sku.trim();
  if (name.trim() !== product.name) changes.name = name.trim();
  if (Number(price) !== product.price) changes.price = Number(price);
  return changes;
}

export function ProductEditForm({ token, product, onSaved }: Readonly<ProductEditFormProps>) {
  const [sku, setSku] = useState(product.sku);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const changes = changedFields(product, sku, name, price);
    if (Object.keys(changes).length === 0) {
      setStatus("No changes to save.");
      return;
    }

    const saved = await updateProduct(token, product.id, changes);
    onSaved(saved);
    setStatus("Saved.");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3" noValidate>
      <div className="space-y-1">
        <label htmlFor="edit-sku" className="block text-sm font-medium">
          SKU
        </label>
        <input id="edit-sku" className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="edit-name" className="block text-sm font-medium">
          Name
        </label>
        <input id="edit-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="edit-price" className="block text-sm font-medium">
          Price
        </label>
        <input
          id="edit-price"
          type="number"
          step="0.01"
          min="0"
          className={inputClass}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-4 sm:col-span-3">
        {status && (
          <p role="status" className="text-sm text-zinc-500">
            {status}
          </p>
        )}
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Save changes
        </button>
      </div>
    </form>
  );
}
