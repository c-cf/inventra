import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/AppHeader";
import { getToken, setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  window.localStorage.clear();
  router.push.mockReset();
});

describe("AppHeader", () => {
  it("shows the signed-in user's name and role", () => {
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("forgets the token and goes to /login on sign out", async () => {
    setToken("tok");
    render(<AppHeader user={{ id: 1, username: "alice", role: "admin" }} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    expect(getToken()).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/login");
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
