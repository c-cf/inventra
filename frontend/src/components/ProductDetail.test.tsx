import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductDetail } from "@/components/ProductDetail";
import {
  ApiError,
  deleteProduct,
  fetchMe,
  fetchProduct,
  updateProduct,
  type Product,
} from "@/lib/api";
import { hardNavigate } from "@/lib/hardNavigate";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const params = vi.hoisted(() => ({ current: { id: "1" } as Record<string, string> }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => params.current,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

const keyboard: Product = {
  id: 1,
  sku: "KB-001",
  name: "Mechanical Keyboard",
  price: 89,
  quantity: 25,
  created_at: "2026-01-01 09:00:00",
};

beforeEach(() => {
  window.localStorage.clear();
  params.current = { id: "1" };
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchProduct).mockReset().mockResolvedValue(keyboard);
  vi.mocked(updateProduct).mockReset();
  vi.mocked(deleteProduct).mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProductDetail", () => {
  it("redirects to /login when there is no session", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError(401, "Not authenticated"));

    render(<ProductDetail />);

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("shows a breadcrumb back to the products list and the stock on hand", async () => {

    render(<ProductDetail />);

    const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
    expect(within(breadcrumb).getByText("KB-001")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Mechanical Keyboard" })).toBeInTheDocument();
    expect(screen.getByText("25 in stock")).toBeInTheDocument();
    expect(fetchProduct).toHaveBeenCalledWith(1);
  });

  it("updates the heading and breadcrumb after a save", async () => {
    vi.mocked(updateProduct).mockResolvedValue({ ...keyboard, sku: "KB-100", name: "Keyboard" });
    render(<ProductDetail />);
    const user = userEvent.setup();

    const name = await screen.findByLabelText(/name/i);
    await user.clear(name);
    await user.type(name, "Keyboard");
    await user.clear(screen.getByLabelText(/sku/i));
    await user.type(screen.getByLabelText(/sku/i), "KB-100");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Keyboard" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("KB-100")).toBeInTheDocument();
  });

  it("deletes the product after confirmation and returns to the list", async () => {
    vi.mocked(deleteProduct).mockResolvedValue(undefined);
    render(<ProductDetail />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete product" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete KB-001 and its stock history? This cannot be undone.",
    );
    expect(deleteProduct).toHaveBeenCalledWith(1);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/products"));
  });

  it("keeps the product when the user declines", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<ProductDetail />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete product" }));

    expect(deleteProduct).not.toHaveBeenCalled();
  });

  it("explains why an ordered product cannot be deleted", async () => {
    vi.mocked(deleteProduct).mockRejectedValue(
      new ApiError(409, "Product has orders and cannot be deleted"),
    );
    render(<ProductDetail />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete product" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Product has orders and cannot be deleted");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("signs the user out when the delete is rejected with 401", async () => {
    vi.mocked(deleteProduct).mockRejectedValue(new ApiError(401, "Not authenticated"));
    render(<ProductDetail />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete product" }));

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
  });

  it("says when the product does not exist and links back", async () => {
    vi.mocked(fetchProduct).mockRejectedValue(new ApiError(404, "Product not found"));

    render(<ProductDetail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Product not found");
    expect(screen.getByRole("link", { name: "Back to products" })).toHaveAttribute("href", "/products");
  });

  it("does not ask the API for an id that is not a number", async () => {
    params.current = { id: "abc" };

    render(<ProductDetail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Product not found");
    expect(fetchProduct).not.toHaveBeenCalled();
  });

  it("does not offer deletion to staff", async () => {
    vi.mocked(fetchMe).mockResolvedValue({ id: 2, username: "bob", role: "staff" });

    render(<ProductDetail />);

    expect(await screen.findByRole("heading", { name: "Mechanical Keyboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete product" })).not.toBeInTheDocument();
  });
});
