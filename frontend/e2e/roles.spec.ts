import { expect, test } from "@playwright/test";

import { addProduct, signIn, uniqueSku } from "./helpers";

/** Accounts created by `python -m app.seed`. */
const STAFF = { username: "staff", password: "staff123" };

test("staff do not get user management or product deletion", async ({ page }) => {
  const sku = uniqueSku("E2E-STAFF");
  await signIn(page, STAFF);
  await addProduct(page, { sku, name: "E2E Staff Product", price: "3", quantity: "3" });

  await expect(page.getByRole("banner").getByRole("link", { name: "Users" })).toHaveCount(0);
  await page.getByRole("link", { name: sku }).click();
  await expect(page.getByRole("heading", { name: "E2E Staff Product" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete product" })).toHaveCount(0);

  await page.goto("/users");
  await expect(page.getByRole("alert").filter({ hasText: "Admin role required" })).toBeVisible();
});

test("an admin adds a staff member who can then sign in and change their password", async ({ page }) => {
  const username = `e2e.${Date.now().toString(36)}`;
  await signIn(page);
  await page.getByRole("banner").getByRole("link", { name: "Users" }).click();
  await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible();

  // Role locators skip the hidden pages Next keeps mounted (e.g. a cached /login).
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill("first-password");
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("staff");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("cell", { name: username })).toBeVisible();
  await expect(page.getByLabel(`Role for ${username}`)).toHaveValue("staff");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/); // sign-out is a full page load; let it finish

  await signIn(page, { username, password: "first-password" });
  await page.getByRole("banner").getByRole("link", { name: new RegExp(username) }).click();
  await page.getByLabel("Current password").fill("first-password");
  await page.getByLabel("New password", { exact: true }).fill("second-password");
  await page.getByLabel("Confirm new password").fill("second-password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Password changed." })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/); // sign-out is a full page load; let it finish

  await signIn(page, { username, password: "second-password" });
  await expect(page.getByRole("banner")).toContainText(username);
});

test("a product that appears on an order cannot be deleted", async ({ page }) => {
  const sku = uniqueSku("E2E-KEEP");
  await signIn(page);
  await addProduct(page, { sku, name: "E2E Ordered Product", price: "4", quantity: "4" });
  await page.goto("/orders/new");
  await page.getByLabel("Customer").fill(`E2E Keeper ${sku}`);
  await page.getByLabel("Product 1").selectOption({ label: `E2E Ordered Product (${sku}) · 4 in stock` });
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/);

  await page.goto("/products");
  await page.getByRole("link", { name: sku }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Product has orders and cannot be deleted" })).toBeVisible();
});
