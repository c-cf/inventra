import type { Product } from "@/lib/api";

type ProductTableProps = {
  products: Product[];
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function ProductTable({ products }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No products yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th scope="col" className="px-4 py-3">SKU</th>
            <th scope="col" className="px-4 py-3">Name</th>
            <th scope="col" className="px-4 py-3 text-right">Price</th>
            <th scope="col" className="px-4 py-3 text-right">Quantity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {products.map((product) => (
            <tr key={product.id}>
              <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
              <td className="px-4 py-3">{product.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{currency.format(product.price)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {product.quantity}
                {product.quantity === 0 && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    Out of stock
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
