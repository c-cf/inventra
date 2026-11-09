"use client";

import { type FormEvent, useState } from "react";

import { createProduct, type Product } from "@/lib/api";

type ProductFormProps = {
  token: string;
  onCreated: (product: Product) => void;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function ProductForm({ token, onCreated }: ProductFormProps) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = await createProduct(token, {
      sku,
      name,
      price: Number(price),
      quantity: Number(quantity),
    });
    onCreated(product);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="sku" className="block text-sm font-medium">SKU</label>
        <input id="sku" className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium">Name</label>
        <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="price" className="block text-sm font-medium">Price</label>
        <input id="price" type="number" step="0.01" min="0" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label htmlFor="quantity" className="block text-sm font-medium">Quantity</label>
        <input id="quantity" type="number" step="1" min="0" className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <button
        type="submit"
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:col-span-4 sm:justify-self-end"
      >
        Add product
      </button>
    </form>
  );
}