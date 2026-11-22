import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UsersPage from "@/app/users/page";
import { ApiError, createUser, fetchMe, fetchUsers, updateUserRole, type UserSummary } from "@/lib/api";
import { setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserRole: vi.fn(),
}));

const alice: UserSummary = { id: 1, username: "alice", role: "admin", created_at: "2026-11-01 08:00:00" };
const bob: UserSummary = { id: 2, username: "bob", role: "staff", created_at: "2026-11-02 08:00:00" };

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 1, username: "alice", role: "admin" });
  vi.mocked(fetchUsers).mockReset().mockResolvedValue([alice, bob]);
  vi.mocked(createUser).mockReset();
  vi.mocked(updateUserRole).mockReset();
});

describe("UsersPage", () => {
  it("redirects to /login when no token is stored", () => {
    render(<UsersPage />);

    expect(router.replace).toHaveBeenCalledWith("/login");
  });

  it("lets an admin see the users and add one", async () => {
    setToken("tok");
    const carol: UserSummary = { id: 3, username: "carol", role: "staff", created_at: "2026-11-23 09:00:00" };
    vi.mocked(createUser).mockResolvedValue(carol);
    render(<UsersPage />);
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "carol");
    await user.type(screen.getByLabelText("Password"), "carolpass1");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const table = screen.getByRole("table");
    expect(await within(table).findByText("carol")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(4);
  });

  it("tells staff that the page needs the admin role", async () => {
    setToken("tok");
    vi.mocked(fetchMe).mockResolvedValue({ id: 2, username: "bob", role: "staff" });
    vi.mocked(fetchUsers).mockRejectedValue(new ApiError(403, "Admin role required"));

    render(<UsersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Admin role required");
  });

  it("updates a row after a role change", async () => {
    setToken("tok");
    vi.mocked(updateUserRole).mockResolvedValue({ ...bob, role: "admin" });
    render(<UsersPage />);

    await userEvent.setup().selectOptions(await screen.findByLabelText("Role for bob"), "admin");

    await waitFor(() => expect(screen.getByLabelText("Role for bob")).toHaveValue("admin"));
  });
});
