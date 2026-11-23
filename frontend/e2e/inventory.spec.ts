import { expect, test } from "@playwright/test";

import { addProduct, quantityCell, signIn, uniqueSku } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("a new product can be restocked and its movement history shows the change", async ({ page }) => {
  const sku = uniqueSku("E2E-INV");
  await addProduct(page, { sku, name: "E2E Restock Widget", price: "12.50", quantity: "3" });

  await page.getByLabel("Adjust product").selectOption({ label: `E2E Restock Widget (${sku})` });
  await page.getByLabel("Stock change").fill("7");
  await page.getByLabel("Adjustment reason").fill("supplier delivery");
  await page.getByRole("button", { name: "Adjust Stock" }).click();

  await expect(page.getByText("E2E Restock Widget now has 10 in stock.")).toBeVisible();
  await expect(quantityCell(page, sku)).toHaveText("10");

  await page.getByLabel("Movement product").selectOption({ label: `E2E Restock Widget (${sku})` });
  await page.getByRole("button", { name: "View Movements" }).click();
  await expect(page.getByRole("cell", { name: "supplier delivery" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "+7" })).toBeVisible();
});

test("taking out more than is in stock is refused", async ({ page }) => {
  const sku = uniqueSku("E2E-SHORT");
  await addProduct(page, { sku, name: "E2E Scarce Widget", price: "5", quantity: "2" });

  await page.getByLabel("Adjust product").selectOption({ label: `E2E Scarce Widget (${sku})` });
  await page.getByLabel("Stock change").fill("-5");
  await page.getByLabel("Adjustment reason").fill("damaged");
  await page.getByRole("button", { name: "Adjust Stock" }).click();

  await expect(page.getByText("Insufficient stock")).toBeVisible();
  await expect(quantityCell(page, sku)).toHaveText("2");
});

test("search and the low-stock filter narrow the list together", async ({ page }) => {
  const tag = uniqueSku("FIND");
  await addProduct(page, { sku: `${tag}-A`, name: `Findable lamp ${tag}`, price: "20", quantity: "1" });
  await addProduct(page, { sku: `${tag}-B`, name: `Findable desk ${tag}`, price: "90", quantity: "50" });

  await page.getByLabel("Search products").fill(tag.toLowerCase());
  await page.getByRole("button", { name: "Search", exact: true }).click();
  // Wait for the filtered list: a seeded product that doesn't match must disappear.
  await expect(page.getByRole("link", { name: "KB-001" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `${tag}-A` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${tag}-B` })).toBeVisible();
  await expect(page.getByText("2 items", { exact: true })).toBeVisible();

  await page.getByLabel("Low stock threshold").fill("5");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByText("1 items", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `${tag}-B` })).toHaveCount(0);
});

test("the search and low-stock filter still apply after coming back from a product (#35)", async ({ page }) => {
  const tag = uniqueSku("BACK");
  await addProduct(page, { sku: `${tag}-A`, name: `Returnable lamp ${tag}`, price: "20", quantity: "1" });
  await addProduct(page, { sku: `${tag}-B`, name: `Returnable desk ${tag}`, price: "90", quantity: "50" });
  await page.getByLabel("Search products").fill(tag.toLowerCase());
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("2 items", { exact: true })).toBeVisible();
  await page.getByLabel("Low stock threshold").fill("5");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByText("1 items", { exact: true })).toBeVisible();

  // Rename it on its own page: the new name shows that the list was reloaded on the way back.
  await page.getByRole("link", { name: `${tag}-A` }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(`${tag}-A`);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(`Renamed lamp ${tag}`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Products" }).click();

  await expect(page.getByRole("row").filter({ hasText: `${tag}-A` })).toContainText(`Renamed lamp ${tag}`);
  await expect(page.getByText("1 items", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "KB-001" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `${tag}-B` })).toHaveCount(0);
  await expect(page.getByLabel("Search products")).toHaveValue(tag.toLowerCase());
  await expect(page.getByLabel("Low stock threshold")).toHaveValue("5");
});

test("a search cleared while the session check is slow stays cleared (#40)", async ({ page }) => {
  const tag = uniqueSku("SLOW");
  await addProduct(page, { sku: `${tag}-A`, name: `Slow-session lamp ${tag}`, price: "20", quantity: "3" });
  await page.getByLabel("Search products").fill(tag.toLowerCase());
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("link", { name: "KB-001" })).toHaveCount(0);
  await page.getByRole("link", { name: `${tag}-A` }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(`${tag}-A`);

  // From here on, answer the session check late, so the list's reload is back long before it.
  await page.route("**/auth/me", async (route) => {
    await new Promise((done) => setTimeout(done, 1500));
    await route.continue();
  });
  const reloaded = page.waitForResponse((response) => response.url().includes("/products?q="));
  const sessionChecked = page.waitForResponse((response) => response.url().endsWith("/auth/me"));
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Products" }).click();
  await reloaded;
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("link", { name: "KB-001" })).toBeVisible();
  await sessionChecked;
  // Checking that something does not happen: give the late answer time to be applied.
  await page.waitForTimeout(500);

  await expect(page.getByRole("link", { name: "KB-001" })).toBeVisible();
  await expect(page.getByLabel("Search products")).toHaveValue("");
});
