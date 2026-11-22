import { expect, type Page, test } from "@playwright/test";

import { addProduct, quantityCell, signIn, uniqueSku } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function placeOrder(page: Page, customer: string, lines: { label: string; quantity: string }[]) {
  // The header's link: order pages also have an "Orders" breadcrumb.
  await page.getByRole("banner").getByRole("link", { name: "Orders", exact: true }).click();
  await page.getByRole("link", { name: "New order" }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("New order");
  await page.getByLabel("Customer").fill(customer);
  for (const [index, line] of lines.entries()) {
    if (index > 0) await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel(`Product ${index + 1}`).selectOption({ label: line.label });
    await page.getByLabel(`Quantity ${index + 1}`).fill(line.quantity);
  }
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/);
}

test("an order with two lines takes stock and moves from pending to shipped", async ({ page }) => {
  const kb = uniqueSku("E2E-KB");
  const ms = uniqueSku("E2E-MS");
  await addProduct(page, { sku: kb, name: "E2E Keyboard", price: "89", quantity: "10" });
  await addProduct(page, { sku: ms, name: "E2E Mouse", price: "25.50", quantity: "5" });

  const customer = `E2E Customer ${uniqueSku("C")}`;
  await placeOrder(page, customer, [
    { label: `E2E Keyboard (${kb}) · 10 in stock`, quantity: "2" },
    { label: `E2E Mouse (${ms}) · 5 in stock`, quantity: "1" },
  ]);

  await expect(page.getByText(customer).filter({ visible: true })).toBeVisible();
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toContainText("pending");
  // The orders list stays mounted (hidden) after navigating, so only look at visible text.
  await expect(page.getByText("$203.50").filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(title).toContainText("paid");
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(title).toContainText("shipped");
  await expect(page.getByText("No further status changes.")).toBeVisible();

  await page.getByRole("link", { name: "Orders", exact: true }).first().click();
  await expect(page.getByRole("row").filter({ hasText: customer })).toContainText("shipped");

  await page.goto("/products");
  await expect(quantityCell(page, kb)).toHaveText("8");
  await expect(quantityCell(page, ms)).toHaveText("4");
});

test("cancelling an order puts its stock back", async ({ page }) => {
  const sku = uniqueSku("E2E-CXL");
  await addProduct(page, { sku, name: "E2E Cancel Widget", price: "10", quantity: "6" });

  await placeOrder(page, `E2E Cancelling ${uniqueSku("C")}`, [
    { label: `E2E Cancel Widget (${sku}) · 6 in stock`, quantity: "4" },
  ]);
  const orderUrl = page.url();
  await page.goto("/products");
  await expect(quantityCell(page, sku)).toHaveText("2");
  await page.goto(orderUrl);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("cancelled");

  await page.goto("/products");
  await expect(quantityCell(page, sku)).toHaveText("6");
});

test("a second order can be placed right after the first (#25)", async ({ page }) => {
  const sku = uniqueSku("E2E-TWICE");
  await addProduct(page, { sku, name: "E2E Twice Widget", price: "3", quantity: "10" });

  await placeOrder(page, `E2E First ${uniqueSku("C")}`, [
    { label: `E2E Twice Widget (${sku}) · 10 in stock`, quantity: "1" },
  ]);
  await placeOrder(page, `E2E Second ${uniqueSku("C")}`, [
    { label: `E2E Twice Widget (${sku}) · 9 in stock`, quantity: "1" },
  ]);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("pending");
});


test("the status filter still applies after coming back from an order (#37)", async ({ page }) => {
  const sku = uniqueSku("E2E-FLT");
  await addProduct(page, { sku, name: "E2E Filter Widget", price: "4", quantity: "5" });
  const stays = `E2E Stays ${uniqueSku("C")}`;
  const paid = `E2E Paid ${uniqueSku("C")}`;
  await placeOrder(page, stays, [{ label: `E2E Filter Widget (${sku}) · 5 in stock`, quantity: "1" }]);
  await placeOrder(page, paid, [{ label: `E2E Filter Widget (${sku}) · 4 in stock`, quantity: "1" }]);
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("paid");

  // The paid order only shows once the list has been reloaded, and only goes once the
  // filter has been applied: each step waits for its own response.
  await page.getByRole("banner").getByRole("link", { name: "Orders", exact: true }).click();
  const paidRow = page.getByRole("row").filter({ hasText: paid });
  await expect(paidRow).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("pending");
  await expect(paidRow).toHaveCount(0);
  const staysRow = page.getByRole("row").filter({ hasText: stays });
  await expect(staysRow).toBeVisible();

  // Pay it on its own page: on the way back, a list reloaded for "pending" no longer has it.
  await staysRow.getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("pending");
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("paid");
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Orders" }).click();

  // A role locator skips the hidden list, so this passes only once /orders is shown again;
  // from then on the list still holds the order until the reload replaces it.
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("pending");
  await expect(staysRow).toHaveCount(0);
  await expect(paidRow).toHaveCount(0);
});
