import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserTable } from "@/components/UserTable";
import { ApiError, updateUserRole, type UserSummary } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  updateUserRole: vi.fn(),
}));

const alice: UserSummary = { id: 1, username: "alice", role: "admin", created_at: "2026-11-01 08:00:00" };
const bob: UserSummary = { id: 2, username: "bob", role: "staff", created_at: "2026-11-02 08:00:00" };
const onChanged = vi.fn();
const onUnauthorized = vi.fn();

function renderTable() {
  render(
    <UserTable
      token="tok"
      users={[alice, bob]}
      currentUserId={1}
      onChanged={onChanged}
      onUnauthorized={onUnauthorized}
    />,
  );
  return userEvent.setup();
}

function roleSelect(username: string) {
  return screen.getByLabelText(`Role for ${username}`);
}

beforeEach(() => {
  vi.mocked(updateUserRole).mockReset();
  onChanged.mockReset();
  onUnauthorized.mockReset();
});

describe("UserTable", () => {
  it("lists every user with their role", () => {
    renderTable();

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("alice")).toBeInTheDocument();
    expect(within(rows[2]).getByText("bob")).toBeInTheDocument();
    expect(roleSelect("alice")).toHaveValue("admin");
    expect(roleSelect("bob")).toHaveValue("staff");
  });

  it("does not let you change your own role", () => {
    renderTable();

    expect(roleSelect("alice")).toBeDisabled();
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("changes another user's role", async () => {
    vi.mocked(updateUserRole).mockResolvedValue({ ...bob, role: "admin" });
    const user = renderTable();

    await user.selectOptions(roleSelect("bob"), "admin");

    expect(updateUserRole).toHaveBeenCalledWith("tok", 2, "admin");
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ ...bob, role: "admin" }));
  });

  it("shows the backend's message when the change is refused", async () => {
    vi.mocked(updateUserRole).mockRejectedValue(new ApiError(404, "User not found"));
    const user = renderTable();

    await user.selectOptions(roleSelect("bob"), "admin");

    expect(await screen.findByRole("alert")).toHaveTextContent("User not found");
    expect(onChanged).not.toHaveBeenCalled();
    expect(roleSelect("bob")).toHaveValue("staff");
  });

  it("hands a rejected token to onUnauthorized", async () => {
    vi.mocked(updateUserRole).mockRejectedValue(new ApiError(401, "Not authenticated"));
    const user = renderTable();

    await user.selectOptions(roleSelect("bob"), "admin");

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });
});
