import { afterEach, describe, expect, it, vi } from "vitest";

import { changePassword, createUser, fetchUsers, updateUserRole, type UserSummary } from "@/lib/api";

const carol: UserSummary = { id: 3, username: "carol", role: "staff", created_at: "2026-11-23 09:00:00" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("user management API", () => {
  it("lists users", async () => {
    const fetchMock = stubFetch(json([carol]));

    expect(await fetchUsers("tok")).toEqual([carol]);
    expect(lastCall(fetchMock).url).toBe("http://localhost:8000/users");
    expect(lastCall(fetchMock).headers.get("authorization")).toBe("Bearer tok");
  });

  it("surfaces the 403 a staff member gets", async () => {
    stubFetch(json({ detail: "Admin role required" }, 403));

    await expect(fetchUsers("tok")).rejects.toMatchObject({ status: 403, message: "Admin role required" });
  });

  it("creates a user", async () => {
    const fetchMock = stubFetch(json(carol, 201));
    const input = { username: "carol", password: "carolpass1", role: "staff" as const };

    expect(await createUser("tok", input)).toEqual(carol);
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/users");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(input));
  });

  it("changes a user's role", async () => {
    const fetchMock = stubFetch(json({ ...carol, role: "admin" }));

    expect((await updateUserRole("tok", 3, "admin")).role).toBe("admin");
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/users/3");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ role: "admin" }));
  });
});

describe("changePassword", () => {
  it("posts the current and new password and accepts the empty 204", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(changePassword("tok", "old-password", "new-password")).resolves.toBeUndefined();
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://localhost:8000/auth/password");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ current_password: "old-password", new_password: "new-password" }));
  });

  it("surfaces a wrong current password", async () => {
    stubFetch(json({ detail: "Current password is incorrect" }, 400));

    await expect(changePassword("tok", "nope", "new-password")).rejects.toMatchObject({
      status: 400,
      message: "Current password is incorrect",
    });
  });
});
