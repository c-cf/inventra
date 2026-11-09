import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductsPage from "@/app/products/page";
import { ApiError, createProduct, fetchMe, fetchProducts } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProducts: vi.fn(),
  createProduct: vi.fn(),
}));

const alice = { id: 1, username: "alice", role: "admin" };
const keyboard = {
  id: 1,
  sku: "KB-001",
  name: "Mechanical Keyboard",
  price: 89,
  quantity: 25,
  created_at: "2026-01-01",
};

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(fetchMe).mockReset();
  vi.mocked(fetchProducts).mockReset();
  vi.mocked(createProduct).mockReset();
});

describe("ProductsPage", () => {
  it("redirects to /login when no token is stored", () => {
    render(<ProductsPage />);

    expect(router.replace).toHaveBeenCalledWith("/login");
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it("shows the signed-in user and the product list", async () => {
    setToken("tok");
    vi.mocked(fetchMe).mockResolvedValue(alice);
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);

    render(<ProductsPage />);

    expect(await screen.findByText("Mechanical Keyboard")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(fetchProducts).toHaveBeenCalledWith("tok");
  });

  it("clears a rejected token and redirects to /login", async () => {
    setToken("stale");
    vi.mocked(fetchMe).mockRejectedValue(new ApiError(401, "Not authenticated"));
    vi.mocked(fetchProducts).mockRejectedValue(new ApiError(401, "Not authenticated"));

    render(<ProductsPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(getToken()).toBeNull();
  });

  it("shows an error when the backend cannot be reached", async () => {
    setToken("tok");
    vi.mocked(fetchMe).mockRejectedValue(new TypeError("Failed to fetch"));
    vi.mocked(fetchProducts).mockRejectedValue(new TypeError("Failed to fetch"));

    render(<ProductsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to fetch/i);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("adds a newly created product to the table", async () => {
    setToken("tok");
    vi.mocked(fetchMe).mockResolvedValue(alice);
    vi.mocked(fetchProducts).mockResolvedValue([keyboard]);
    const mouse = { id: 2, sku: "MS-002", name: "Mouse", price: 25, quantity: 10, created_at: "2026-11-09" };
    vi.mocked(createProduct).mockResolvedValue(mouse);

    render(<ProductsPage />);
    await screen.findByText("Mechanical Keyboard");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/sku/i), "MS-002");
    await user.type(screen.getByLabelText(/name/i), "Mouse");
    await user.type(screen.getByLabelText(/price/i), "25");
    await user.type(screen.getByLabelText(/quantity/i), "10");
    await user.click(screen.getByRole("button", { name: /add product/i }));

    expect(createProduct).toHaveBeenCalledWith("tok", { sku: "MS-002", name: "Mouse", price: 25, quantity: 10 });
    expect(await screen.findByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });
});
