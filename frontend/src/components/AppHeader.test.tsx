import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/AppHeader";
import { logout } from "@/lib/api";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  logout: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockReset();
  vi.mocked(logout).mockReset().mockResolvedValue(undefined);
});

describe("AppHeader", () => {
  it("shows the signed-in user's name and role", () => {
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("signs out through the API (which clears the httpOnly cookie) and goes to /login", async () => {
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    expect(logout).toHaveBeenCalledOnce();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });

  it("says so and stays put when the sign-out request fails", async () => {
    // The session cookie is httpOnly, so only the API can clear it; leaving the page
    // would look like a sign-out while the session is still valid.
    vi.mocked(logout).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not sign out. Check your connection and try again.",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("links to the products and orders pages", () => {
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/orders");
  });

  it("shows admins a link to user management", () => {
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      "/users",
    );
  });

  it("hides user management from staff", () => {
    render(<AppHeader user={{ id: 2, username: "bob", role: "staff" }} />);

    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("links the signed-in user to their account page", () => {
    render(<AppHeader user={{ id: 2, username: "bob", role: "staff" }} />);

    expect(screen.getByRole("link", { name: /bob/ })).toHaveAttribute("href", "/account");
  });
});
