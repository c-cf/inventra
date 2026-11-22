import { describe, expect, it, vi } from "vitest";

import { loadForLatest } from "@/lib/loadForLatest";

describe("loadForLatest", () => {
  it("loads once when the key stays the same", async () => {
    const latest = { current: "paid" };
    const load = vi.fn(async (key: string) => `orders for ${key}`);

    await expect(loadForLatest(latest, load)).resolves.toBe("orders for paid");
    expect(load).toHaveBeenCalledOnce();
  });

  it("loads again for the new key when it changed during the request", async () => {
    const latest = { current: "paid" };
    const load = vi.fn(async (key: string) => {
      if (key === "paid") latest.current = "shipped"; // the user picks another status meanwhile
      return `orders for ${key}`;
    });

    await expect(loadForLatest(latest, load)).resolves.toBe("orders for shipped");
    expect(load.mock.calls).toEqual([["paid"], ["shipped"]]);
  });

  it("passes a failed request on", async () => {
    const load = vi.fn(async () => {
      throw new Error("Database unavailable");
    });

    await expect(loadForLatest({ current: 1 }, load)).rejects.toThrow("Database unavailable");
  });
});
