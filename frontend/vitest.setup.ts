import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

import { hardNavigate } from "@/lib/hardNavigate";
import { afterEach, vi } from "vitest";

// Without Vitest globals, Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  vi.mocked(hardNavigate).mockClear();
});

// Full page loads (window.location.assign) aren't implemented by jsdom; tests
// assert on this mock instead.
vi.mock("@/lib/hardNavigate", () => ({ hardNavigate: vi.fn() }));
