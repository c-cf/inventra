import { expect, type Page } from "@playwright/test";

/** Accounts created by `python -m app.seed`. */
export const ADMIN = { username: "admin", password: "admin123" };

let counter = 0;

/** A SKU no other test (or earlier run against the same database) has used. */
export function uniqueSku(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`.toUpperCase();
}

export async function signIn(page: Page, account = ADMIN): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/products$/);
}

export async function addProduct(
  page: Page,
  product: { sku: string; name: string; price: string; quantity: string },
): Promise<void> {
  await page.goto("/products");
  // Role locators skip hidden elements; Next keeps the previous page mounted but hidden.
  await page.getByRole("textbox", { name: "SKU", exact: true }).fill(product.sku);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(product.name);
  await page.getByRole("spinbutton", { name: "Price", exact: true }).fill(product.price);
  await page.getByRole("spinbutton", { name: "Quantity", exact: true }).fill(product.quantity);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("link", { name: product.sku })).toBeVisible();
}

/** The quantity cell of a product's row in the products table. */
export function quantityCell(page: Page, sku: string) {
  return page.getByRole("row").filter({ has: page.getByRole("link", { name: sku }) }).getByRole("cell").nth(3);
}
