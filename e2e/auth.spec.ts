import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./support/a11y";

test("login page renders the public authentication Interface", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("img", { name: "GlowBook" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Iniciar/i })).toBeVisible();
  await expect(page.getByLabel(/Correo|Email/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Contraseña", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Iniciar/i })).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test("protected salon routes redirect anonymous users to login", async ({ page }) => {
  await page.goto("/appointments");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Iniciar/i })).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});
