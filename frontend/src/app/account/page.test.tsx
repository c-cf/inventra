import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountPage from "@/app/account/page";
import { ApiError, changePassword, fetchMe } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMe: vi.fn(),
  changePassword: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  vi.mocked(fetchMe).mockReset().mockResolvedValue({ id: 2, username: "bob", role: "staff" });
  vi.mocked(changePassword).mockReset();
});

describe("AccountPage", () => {
  it("redirects to /login when no token is stored", () => {
    render(<AccountPage />);

    expect(router.replace).toHaveBeenCalledWith("/login");
  });

  it("shows who is signed in and the password form", async () => {
    setToken("tok");

    render(<AccountPage />);

    expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText(/signed in as/i)).toHaveTextContent("Signed in as bob (staff)");
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
  });

  it("signs the user out when the password change is rejected with 401", async () => {
    setToken("tok");
    vi.mocked(changePassword).mockRejectedValue(new ApiError(401, "Not authenticated"));
    render(<AccountPage />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Current password"), "old-password");
    await user.type(screen.getByLabelText("New password"), "brand-new-pass");
    await user.type(screen.getByLabelText("Confirm new password"), "brand-new-pass");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(getToken()).toBeNull();
  });
});
