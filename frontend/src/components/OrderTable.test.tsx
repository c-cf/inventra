import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderTable } from "@/components/OrderTable";
import type { Order } from "@/lib/api";

const order: Order = {
  id: 7,
  customer_name: "ACME Corp",
  status: "paid",
  created_by: 1,
  created_at: "2026-11-22T10:00:00Z",
  items: [
    { product_id: 1, sku: "KB-001", name: "Keyboard", quantity: 2, unit_price: 89, line_total: 178 },
    { product_id: 2, sku: "MS-001", name: "Mouse", quantity: 1, unit_price: 25.5, line_total: 25.5 },
  ],
  total: 203.5,
};

describe("OrderTable", () => {
  it("shows an empty state when there are no orders", () => {
    render(<OrderTable orders={[]} />);

    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders one row per order with a link to its detail page", () => {
    render(<OrderTable orders={[order]} />);

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByRole("link", { name: "#7" })).toHaveAttribute("href", "/orders/7");
    expect(within(row).getByText("ACME Corp")).toBeInTheDocument();
    expect(within(row).getByText("paid")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("$203.50")).toBeInTheDocument();
    expect(within(row).getByText("2026-11-22 18:00")).toBeInTheDocument(); // local (UTC+8)
  });
});
