import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserCreateForm } from "@/components/UserCreateForm";
import { ApiError, createUser, type UserSummary } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createUser: vi.fn(),
}));

const carol: UserSummary = { id: 3, username: "carol", role: "admin", created_at: "2026-11-23 09:00:00" };
const onCreated = vi.fn();
const onUnauthorized = vi.fn();

async function submit(username: string, password: string, role?: string) {
  render(<UserCreateForm onCreated={onCreated} onUnauthorized={onUnauthorized} />);
  const user = userEvent.setup();
  if (username) await user.type(screen.getByLabelText("Username"), username);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  if (role) await user.selectOptions(screen.getByLabelText("Role"), role);
  await user.click(screen.getByRole("button", { name: "Create user" }));
}

beforeEach(() => {
  vi.mocked(createUser).mockReset();
  onCreated.mockReset();
  onUnauthorized.mockReset();
});

describe("UserCreateForm", () => {
  it("defaults new accounts to staff", () => {
    render(<UserCreateForm onCreated={onCreated} onUnauthorized={onUnauthorized} />);

    expect(screen.getByLabelText("Role")).toHaveValue("staff");
  });

  it("creates the user, reports it and clears the form", async () => {
    vi.mocked(createUser).mockResolvedValue(carol);

    await submit("  carol  ", "carolpass1", "admin");

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(carol));
    expect(createUser).toHaveBeenCalledWith({ username: "carol", password: "carolpass1", role: "admin" });
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Role")).toHaveValue("staff");
  });

  it.each([
    ["ab", "carolpass1", "Username must be 3 to 150 characters."],
    ["x".repeat(151), "carolpass1", "Username must be 3 to 150 characters."],
    ["has space", "carolpass1", "Username may only use letters, digits, '.', '_' and '-'."],
    ["carol", "short7!", "Password must be at least 8 characters."],
    ["carol", "é".repeat(37), "Password must be at most 72 bytes."],
  ])("rejects %j / %j without calling the API", async (username, password, message) => {
    await submit(username, password);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("shows the backend's message for a taken username", async () => {
    vi.mocked(createUser).mockRejectedValue(new ApiError(409, "Username already exists"));

    await submit("carol", "carolpass1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Username already exists");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("hands a rejected token to onUnauthorized", async () => {
    vi.mocked(createUser).mockRejectedValue(new ApiError(401, "Not authenticated"));

    await submit("carol", "carolpass1");

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });
});
