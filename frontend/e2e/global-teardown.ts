import { rm } from "node:fs/promises";

/** Remove the run's temporary database (see playwright.config.ts). */
export default async function globalTeardown(): Promise<void> {
  const dbPath = process.env.E2E_DB_PATH;
  if (!dbPath) return;
  for (const file of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    await rm(file, { force: true });
  }
}
