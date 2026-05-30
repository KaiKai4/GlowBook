import { expect, test } from "@playwright/test";

test("login page renders the public authentication Interface", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "GlowBook" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Iniciar/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel(/Contrase/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Iniciar/i })).toBeVisible();
});

test("protected salon routes redirect anonymous users to login", async ({ page }) => {
  await page.goto("/appointments");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Iniciar/i })).toBeVisible();
});
