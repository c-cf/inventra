import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ApiError, changePassword } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  changePassword: vi.fn(),
}));

const onUnauthorized = vi.fn();

async function fill(current: string, next: string, confirm: string) {
  render(<ChangePasswordForm token="tok" onUnauthorized={onUnauthorized} />);
  const user = userEvent.setup();
  if (current) await user.type(screen.getByLabelText("Current password"), current);
  if (next) await user.type(screen.getByLabelText("New password"), next);
  if (confirm) await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Change password" }));
}

beforeEach(() => {
  vi.mocked(changePassword).mockReset();
  onUnauthorized.mockReset();
});

describe("ChangePasswordForm", () => {
  it("changes the password, confirms it and clears the fields", async () => {
    vi.mocked(changePassword).mockResolvedValue(undefined);

    await fill("old-password", "brand-new-pass", "brand-new-pass");

    expect(await screen.findByRole("status")).toHaveTextContent("Password changed.");
    expect(changePassword).toHaveBeenCalledWith("tok", "old-password", "brand-new-pass");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it.each([
    ["", "brand-new-pass", "brand-new-pass", "Enter your current password."],
    ["old-password", "short7!", "short7!", "New password must be at least 8 characters."],
    ["old-password", "é".repeat(37), "é".repeat(37), "New password must be at most 72 bytes."],
    ["old-password", "brand-new-pass", "brand-new-pasS", "The new passwords do not match."],
  ])("rejects %j / %j / %j without calling the API", async (current, next, confirm, message) => {
    await fill(current, next, confirm);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("shows the backend's message for a wrong current password", async () => {
    vi.mocked(changePassword).mockRejectedValue(new ApiError(400, "Current password is incorrect"));

    await fill("wrong-password", "brand-new-pass", "brand-new-pass");

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
  });

  it("hands a rejected token to onUnauthorized", async () => {
    vi.mocked(changePassword).mockRejectedValue(new ApiError(401, "Not authenticated"));

    await fill("old-password", "brand-new-pass", "brand-new-pass");

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });
});
