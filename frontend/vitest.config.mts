import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Run every test in one fixed time zone (UTC+8, no daylight saving) so local-time
// formatting is deterministic on any machine, CI included.
process.env.TZ = "Asia/Taipei";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reporter: ["text", "html", "json-summary"],
      // Floors, not goals: raise them as coverage improves, never lower them.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
