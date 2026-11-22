import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests drive the real UI against the real API.
 *
 * Both servers are started here: the API on :8000 with a fresh, seeded SQLite
 * file in the temp directory, and the production build of the UI on :3000.
 * Ports 8000 and 3000 must be free (stop any dev servers first).
 */
const API_URL = "http://localhost:8000";
const APP_URL = "http://localhost:3000";
// Unique per run (and exported for global-teardown.ts, which deletes it afterwards).
process.env.E2E_DB_PATH ??= path.join(os.tmpdir(), `inventra-e2e-${process.pid}-${Date.now()}.db`);
const DB_PATH = process.env.E2E_DB_PATH;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  // One worker: every test shares the seeded database, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "uv run python -m app.seed && uv run uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: `${API_URL}/health`,
      env: {
        INVENTRA_DB_PATH: DB_PATH,
        INVENTRA_CORS_ORIGINS: APP_URL,
        // Every test signs in from the same address; don't let the throttle get in the way.
        INVENTRA_LOGIN_MAX_ATTEMPTS_PER_CLIENT: "1000",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run build && npm run start -- --port 3000",
      url: `${APP_URL}/login`,
      env: { NEXT_PUBLIC_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
