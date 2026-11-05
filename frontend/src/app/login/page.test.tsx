import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { login } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  login: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  router.replace.mockReset();
  router.push.mockReset();
  vi.mocked(login).mockReset();
});

describe("LoginPage", () => {
  it("sends an already signed-in visitor to /products", () => {
    setToken("tok");

    render(<LoginPage />);

    expect(router.replace).toHaveBeenCalledWith("/products");
  });

  it("stores the token and navigates to /products after signing in", async () => {
    vi.mocked(login).mockResolvedValue({ access_token: "tok", token_type: "bearer" });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/products"));
    expect(getToken()).toBe("tok");
  });
});
