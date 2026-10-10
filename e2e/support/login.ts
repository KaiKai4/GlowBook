import { expect, type Page } from "@playwright/test";
import {
  claimLoginSlot,
  readCachedSession,
  releaseLoginSlot,
  removeCachedSession,
  sessionCacheFile,
  writeCachedSession,
} from "./session-cache";

export interface LoginOptions {
  /** Login real por la UI, sin leer ni escribir la caché (cierres de sesión, cambios de credenciales). */
  fresh?: boolean;
}

/** Inicia sesión por la UI con las credenciales dadas y espera salir de /login. */
async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/Correo|Email/i).fill(email);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(password);
  await page.getByRole("button", { name: /Iniciar/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Carga las cookies cacheadas en el contexto y comprueba que la sesión sigue viva.
 * Si la app redirige a /login (caducada o revocada), borra la caché y devuelve false.
 */
async function reuseCachedSession(page: Page, file: string): Promise<boolean> {
  const session = await readCachedSession(file);
  if (!session) return false;
  await page.context().addCookies(session.cookies);
  await page.goto("/login");
  if (!page.url().includes("/login")) return true;
  await removeCachedSession(file);
  return false;
}

/**
 * Deja la página con la sesión del usuario. Reutiliza la caché por usuario y solo hace
 * un login real por la UI la primera vez (o si la sesión cacheada ya no vale).
 */
export async function loginWith(
  page: Page,
  email: string,
  password: string,
  options: LoginOptions = {},
): Promise<void> {
  if (options.fresh) {
    await loginViaUi(page, email, password);
    return;
  }

  const file = sessionCacheFile(email);
  if (await reuseCachedSession(page, file)) return;

  const owner = await claimLoginSlot(file);
  try {
    // Mientras esperábamos, otro worker pudo dejar la caché lista.
    if (!owner && (await reuseCachedSession(page, file))) return;
    await loginViaUi(page, email, password);
    const state = await page.context().storageState();
    await writeCachedSession(file, state.cookies);
  } finally {
    if (owner) await releaseLoginSlot(file);
  }
}
