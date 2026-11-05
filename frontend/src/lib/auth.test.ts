import { beforeEach, describe, expect, it } from "vitest";

import { clearToken, getToken, setToken } from "@/lib/auth";

beforeEach(() => {
  window.localStorage.clear();
});

describe("token storage", () => {
  it("returns null when nothing is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("round-trips a stored token", () => {
    setToken("tok");

    expect(getToken()).toBe("tok");
  });

  it("forgets the token on clear", () => {
    setToken("tok");
    clearToken();

    expect(getToken()).toBeNull();
  });
});
