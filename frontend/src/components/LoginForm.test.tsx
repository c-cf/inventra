import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/LoginForm";
import { ApiError, login, type TokenResponse } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  login: vi.fn(),
}));

const loginMock = vi.mocked(login);

async function fillAndSubmit(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/username/i), username);
  await user.type(screen.getByLabelText(/password/i), password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

beforeEach(() => {
  loginMock.mockReset();
});

describe("LoginForm", () => {
  it("submits the entered credentials and reports the token", async () => {
    loginMock.mockResolvedValue({ access_token: "tok", token_type: "bearer" });
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await fillAndSubmit("alice", "secret123");

    expect(loginMock).toHaveBeenCalledWith("alice", "secret123");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("tok"));
  });

  it("shows the backend's message when the credentials are rejected", async () => {
    loginMock.mockRejectedValue(new ApiError(401, "Invalid username or password"));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await fillAndSubmit("alice", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a generic message when the backend cannot be reached", async () => {
    loginMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginForm onSuccess={vi.fn()} />);

    await fillAndSubmit("alice", "secret123");

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveLogin!: (value: TokenResponse) => void;
    loginMock.mockReturnValue(new Promise<TokenResponse>((resolve) => (resolveLogin = resolve)));
    render(<LoginForm onSuccess={vi.fn()} />);

    await fillAndSubmit("alice", "secret123");

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolveLogin({ access_token: "tok", token_type: "bearer" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled(),
    );
  });
});
