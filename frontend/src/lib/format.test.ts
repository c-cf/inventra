import { describe, expect, it } from "vitest";

import { formatTimestamp } from "@/lib/format";

// vitest.config.mts pins TZ to Asia/Taipei (UTC+8).
describe("formatTimestamp", () => {
  it("shows an API timestamp in the viewer's local time (#26)", () => {
    expect(formatTimestamp("2026-11-22T18:46:25Z")).toBe("2026-11-23 02:46");
  });

  it("treats a timestamp without a zone as UTC, the way SQLite stores it", () => {
    expect(formatTimestamp("2026-11-22 18:46:25")).toBe("2026-11-23 02:46");
  });

  it("pads single-digit parts", () => {
    expect(formatTimestamp("2026-01-04T23:05:00Z")).toBe("2026-01-05 07:05");
  });

  it("leaves something that isn't a timestamp as it is", () => {
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});
