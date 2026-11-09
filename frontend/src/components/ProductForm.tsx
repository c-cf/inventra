"use client";

import { type FormEvent, useState } from "react";

import { ApiError, createProduct, type Product } from "@/lib/api";

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
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null{
    if (sku.trim() === "") return "SKU is required.";
    if (name.trim() === "") return "Name is required.";
    if (Number(price) < 0) return "Price must be 0 or more.";
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) return "Quantity must be a whole number of 0 or more.";
    return null;
  }
  
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = validate();
    setError(problem);
    if (problem) return;

    try {
      const product = await createProduct(token, {
        sku,
        name,
        price: Number(price),
        quantity: Number(quantity),
      });
      onCreated(product);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
    }
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
      {error &&(
        <p
            role ="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-4 dark:bg-red-950 dark:text-red-300"
        >
            {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:col-span-4 sm:justify-self-end"
      >
        Add product
      </button>
    </form>
  );
}