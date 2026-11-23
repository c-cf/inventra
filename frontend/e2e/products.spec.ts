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

test("a product added while the list reloads stays listed (#43)", async ({ page }) => {
  const sku = uniqueSku("E2E-RACE");
  const isListRequest = (url: URL) => url.host === "localhost:8000" && url.pathname === "/products";
  await page.getByRole("link", { name: "KB-001" }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("KB-001");

  // Coming back reloads the list. Let the API answer that reload right away, before the
  // product exists, but hand the answer to the page only once the product was added.
  let releaseList: () => void = () => {};
  const listHeld = new Promise<void>((done) => (releaseList = done));
  let markServed: () => void = () => {};
  const staleServed = new Promise<void>((done) => (markServed = done));
  let holding = true;
  await page.route(isListRequest, async (route) => {
    if (route.request().method() !== "GET" || !holding) return route.continue();
    holding = false; // only the come-back reload; asking again goes straight through
    const answer = await route.fetch();
    markServed();
    await listHeld;
    await route.fulfill({ response: answer });
  });
  const staleDelivered = page.waitForResponse(
    (response) => isListRequest(new URL(response.url())) && response.request().method() === "GET",
  );
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Products" }).click();
  await staleServed;

  await page.getByRole("textbox", { name: "SKU", exact: true }).fill(sku);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("E2E Race Widget");
  await page.getByRole("spinbutton", { name: "Price", exact: true }).fill("7");
  await page.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("2");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("link", { name: sku })).toBeVisible();
  releaseList();
  await (await staleDelivered).finished();
  // Checking that something does not happen: give the late answer time to be applied.
  await page.waitForTimeout(500);

  await expect(page.getByRole("link", { name: sku })).toBeVisible();
});
