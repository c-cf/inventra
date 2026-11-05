import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductTable } from "@/components/ProductTable";
import type { Product } from "@/lib/api";

const products: Product[] = [
  { id: 1, sku: "KB-001", name: "Mechanical Keyboard", price: 89, quantity: 25, created_at: "2026-01-01" },
  { id: 2, sku: "HS-001", name: "USB-C Hub", price: 39.9, quantity: 0, created_at: "2026-01-02" },
];

describe("ProductTable", () => {
  it("shows an empty state when there are no products", () => {
    render(<ProductTable products={[]} />);

    expect(screen.getByText(/no products yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders one row per product with sku, name, formatted price and quantity", () => {
    render(<ProductTable products={products} />);

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("KB-001");
    expect(rows[0]).toHaveTextContent("Mechanical Keyboard");
    expect(rows[0]).toHaveTextContent("$89.00");
    expect(rows[0]).toHaveTextContent("25");
  });

  it("flags products that are out of stock", () => {
    render(<ProductTable products={products} />);

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[1]).toHaveTextContent(/out of stock/i);
    expect(rows[0]).not.toHaveTextContent(/out of stock/i);
  });
});
