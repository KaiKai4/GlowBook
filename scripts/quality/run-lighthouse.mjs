// Ejecuta Lighthouse CI ("lhci autorun") sobre la build local usando el Chromium
// completo que instala Playwright (no el headless-shell ni Google Chrome del sistema).
//
// Dos configuraciones, cada una con su propio servidor "next start" en el puerto 3200:
//  - lighthouserc.json: pantallas públicas.
//  - lighthouserc.auth.json: pantallas autenticadas, con un salón y un owner de prueba
//    creados en el stack LOCAL para esta ejecución y borrados al terminar.
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
import { createLighthouseOwner } from "./lighthouse-owner.mjs";
import { ensureLocalSupabase, getLocalSupabaseEnv } from "./supabase-env.mjs";

const CONFIGS = ["lighthouserc.json", "lighthouserc.auth.json"];

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

/**
 * Ejecuta "lhci autorun" para una configuración. Si falla, lo repite una vez: Lighthouse
 * puede abortar una pasada con NO_NAVSTART por ruido del entorno (Chrome y Docker en la
 * misma máquina). Las aserciones se aplican igual a la pasada que se repite.
 * @returns {number} código de salida (0 si alguna pasada cumple las aserciones)
 */
function runAutorunWithRetry(config, extraArgs, env) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = spawnSync(
      process.execPath,
      [resolveLhciEntry(), "autorun", `--config=${config}`, ...extraArgs],
      { cwd: ROOT, env, stdio: "inherit", shell: false, windowsHide: true },
    );
    if (result.error) throw result.error;
    if (result.status === 0) return 0;
    if (attempt === 1) console.error(`[lighthouse] ${config} falló; se repite una vez.`);
  }
  return 1;
}

async function main() {
  const extraArgs = process.argv.slice(2);
  const chromePath = resolveChromiumPath();
  await ensureLocalSupabase();
  const supabaseEnv = await getLocalSupabaseEnv();
  const owner = await createLighthouseOwner({
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  });

  const env = {
    ...process.env,
    ...supabaseEnv,
    CHROME_PATH: chromePath,
    LH_OWNER_EMAIL: owner.email,
    LH_OWNER_PASSWORD: owner.password,
  };

  let status = 0;
  try {
    for (const config of CONFIGS) {
      status = status || runAutorunWithRetry(config, extraArgs, env);
    }
  } finally {
    await owner.cleanup().catch((error) => {
      console.error(`[lighthouse] No se pudo limpiar el salón de prueba: ${error.message}`);
    });
  }
  process.exit(status);
}

main().catch((error) => {
  console.error(`[lighthouse] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
