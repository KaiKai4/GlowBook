// puppeteerScript de Lighthouse CI para las auditorías autenticadas (lighthouserc.auth.json).
// Inicia sesión por la UI como owner de un salón de prueba creado por run-lighthouse.mjs.
// Las credenciales llegan por entorno; nunca se imprimen. Las cookies quedan en el
// navegador de lhci porque la configuración desactiva el borrado de almacenamiento.
"use strict";

const BASE_URL = process.env.LH_BASE_URL ?? "http://127.0.0.1:3200";
const LOGIN_TIMEOUT_MS = 30_000;

module.exports = async function loginForLighthouse(browser) {
  const email = process.env.LH_OWNER_EMAIL;
  const password = process.env.LH_OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Faltan LH_OWNER_EMAIL y LH_OWNER_PASSWORD. Ejecuta Lighthouse con scripts/quality/run-lighthouse.mjs."
    );
  }

  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "load", timeout: LOGIN_TIMEOUT_MS });
    // Con las cookies de la ejecución anterior, /login redirige al panel: ya hay sesión.
    if (!page.url().includes("/login")) return;
    await page.waitForSelector('input[type="email"]', { timeout: LOGIN_TIMEOUT_MS });
    await page.type('input[type="email"]', email);
    await page.waitForSelector('input[autocomplete="current-password"]', { timeout: LOGIN_TIMEOUT_MS });
    await page.type('input[autocomplete="current-password"]', password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
        timeout: LOGIN_TIMEOUT_MS,
      }),
    ]);
  } finally {
    await page.close();
  }
};
