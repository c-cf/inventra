import { describe, expect, it } from "vitest";

import { newPasswordProblem } from "@/lib/passwords";

describe("newPasswordProblem", () => {
  it.each([
    ["exactly 8 characters", "eightchr"],
    ["exactly 72 bytes of ASCII", "a".repeat(72)],
    ["exactly 72 bytes of two-byte characters", "é".repeat(36)],
    ["4-byte characters counted once each", "😀".repeat(8)],
  ])("accepts %s", (_case, password) => {
    expect(newPasswordProblem(password)).toBeNull();
  });

  it.each([
    ["7 characters", "sevench", "Password must be at least 8 characters."],
    ["4 emoji (8 UTF-16 units, but 4 characters)", "😀".repeat(4), "Password must be at least 8 characters."],
    ["73 bytes", "a".repeat(73), "Password must be at most 72 bytes."],
    ["74 bytes of two-byte characters", "é".repeat(37), "Password must be at most 72 bytes."],
  ])("rejects %s", (_case, password, message) => {
    expect(newPasswordProblem(password)).toBe(message);
  });
});
