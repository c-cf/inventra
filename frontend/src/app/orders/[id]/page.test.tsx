import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderPage from "@/app/orders/[id]/page";

vi.mock("@/components/OrderDetail", () => ({
  OrderDetail: () => <p>order detail</p>,
}));

describe("OrderPage", () => {
  it("renders the order detail view", async () => {
    render(<OrderPage />);

    expect(await screen.findByText("order detail")).toBeInTheDocument();
  });
});
