import { expect, test } from "@playwright/test";

import { ADMIN, signIn } from "./helpers";

test.describe("signing in and out", () => {
  test("a signed-out visitor is sent to the login page", async ({ page }) => {
    await page.goto("/products");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password is rejected with the API's message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(ADMIN.username);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Next's route announcer is also role="alert", so match the message itself.
    await expect(page.getByRole("alert").filter({ hasText: "Invalid username or password" })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the admin signs in, sees the products and signs out again", async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("admin");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/products");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signing out leaves an empty login form for the next person (#24)", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue("");
    await expect(page.getByLabel("Password").filter({ visible: true })).toHaveValue("");
  });
});
