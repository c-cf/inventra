import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { ApiError, fetchMe, login } from "@/lib/api";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  login: vi.fn(),
  fetchMe: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(login).mockReset();
  vi.mocked(fetchMe).mockReset().mockRejectedValue(new ApiError(401, "Not authenticated"));
});

describe("LoginPage", () => {
  it("sends a visitor who already has a session to /products", async () => {
    vi.mocked(fetchMe).mockResolvedValue({ id: 1, username: "alice", role: "admin" });

    render(<LoginPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/products"));
  });

  it("stays on the form when there is no session", async () => {
    render(<LoginPage />);

    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("navigates to /products after signing in without keeping the token in the page", async () => {
    vi.mocked(login).mockResolvedValue({ access_token: "tok", token_type: "bearer" });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/products"));
    // The session is the httpOnly cookie the API set; nothing goes into browser storage.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
