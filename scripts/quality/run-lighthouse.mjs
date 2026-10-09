// Ejecuta Lighthouse CI ("lhci autorun") sobre la build local usando el Chromium
// completo que instala Playwright (no el headless-shell ni Google Chrome del sistema).
//
// Uso: node scripts/quality/run-lighthouse.mjs [argumentos extra de lhci]
//
// La ruta se obtiene de la API de @playwright/test y se pasa a Lighthouse con
// CHROME_PATH. El binario de lhci se invoca directamente (sin shell).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
// Importar el manifiesto declara el uso de @lhci/cli y da la ruta de su binario.
import lhciManifest from "@lhci/cli/package.json" with { type: "json" };
import { ROOT } from "./lib-process.mjs";

/**
 * Ruta del ejecutable de Chromium completo de Playwright, verificada en disco.
 * @returns {string}
 */
function resolveChromiumPath() {
  const executablePath = chromium.executablePath();
  // El headless-shell no sirve para Lighthouse en este flujo: se exige el Chromium completo.
  if (/headless[_-]shell/i.test(executablePath)) {
    throw new Error(
      `Playwright devolvió el headless-shell (${executablePath}); se requiere el Chromium completo.`,
    );
  }
  if (!existsSync(executablePath)) {
    throw new Error(
      `No existe Chromium en ${executablePath}. Instálalo con "npx playwright install --with-deps chromium".`,
    );
  }
  return executablePath;
}

/**
 * Ruta absoluta al entrypoint de @lhci/cli, leída de su campo "bin".
 * @returns {string}
 */
function resolveLhciEntry() {
  const lhciDir = join(ROOT, "node_modules", "@lhci", "cli");
  const bin = typeof lhciManifest.bin === "string" ? lhciManifest.bin : lhciManifest.bin?.lhci;
  if (typeof bin !== "string") {
    throw new Error("@lhci/cli no declara el binario \"lhci\" en package.json.");
  }
  return join(lhciDir, bin);
}

function main() {
  const extraArgs = process.argv.slice(2);
  const chromePath = resolveChromiumPath();
  const result = spawnSync(process.execPath, [resolveLhciEntry(), "autorun", ...extraArgs], {
    cwd: ROOT,
    env: { ...process.env, CHROME_PATH: chromePath },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

main();
