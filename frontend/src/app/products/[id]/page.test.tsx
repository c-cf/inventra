import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProductPage from "@/app/products/[id]/page";

vi.mock("@/components/ProductDetail", () => ({
  ProductDetail: () => <p>product detail</p>,
}));

describe("ProductPage", () => {
  it("renders the product detail view", async () => {
    render(<ProductPage />);

    expect(await screen.findByText("product detail")).toBeInTheDocument();
  });
});
