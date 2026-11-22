import { expect, test } from "@playwright/test";

import { addProduct, signIn, uniqueSku } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("a product is edited on its own page", async ({ page }) => {
  const sku = uniqueSku("E2E-EDIT");
  await addProduct(page, { sku, name: "E2E Old Name", price: "15", quantity: "1" });

  await page.getByRole("link", { name: sku }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(sku);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("E2E New Name");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(page.getByRole("heading", { name: "E2E New Name" })).toBeVisible();

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("row").filter({ hasText: sku })).toContainText("E2E New Name");
});

test("an unordered product can be deleted", async ({ page }) => {
  const sku = uniqueSku("E2E-DEL");
  await addProduct(page, { sku, name: "E2E Disposable", price: "1", quantity: "1" });

  await page.getByRole("link", { name: sku }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();

  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("link", { name: sku })).toHaveCount(0);
});
