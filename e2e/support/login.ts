import { expect, type Page } from "@playwright/test";

/** Inicia sesión por la UI con las credenciales dadas y espera salir de /login. */
export async function loginWith(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/Correo|Email/i).fill(email);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(password);
  await page.getByRole("button", { name: /Iniciar/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
