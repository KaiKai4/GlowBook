// Aplica migraciones pendientes a production desde la automatización de release.
// Uso (solo CI, environment production):
//   GLOWBOOK_RELEASE_AUTOMATION=true PRODUCTION_DB_URL=... PRODUCTION_PROJECT_REF=...
//   node scripts/release/apply-migrations.mjs --confirm=<PRODUCTION_PROJECT_REF>
// La comprobación posterior (que no quedan pendientes) la hace production-migration-gate.mjs.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildPushArgs, redactDbUrl, validateApplyRequest } from "./migrations-logic.mjs";

/**
 * Ejecuta el CLI de Supabase del paquete npm (en Windows va por cmd.exe, igual que el gate).
 * @param {string[]} pushArgs argv completo empezando por "supabase"
 * @returns {import("node:child_process").SpawnSyncReturns<string>}
 */
export function runNpx(pushArgs) {
  if (process.platform === "win32") {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", "npx.cmd", ...pushArgs], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    });
  }
  return spawnSync("npx", pushArgs, { encoding: "utf8", shell: false });
}

/** @returns {void} */
function main() {
  const args = process.argv.slice(2);
  const env = process.env;
  const request = validateApplyRequest({ env, args });
  if (!request.ok) {
    for (const error of request.errors) console.error(`[apply-migrations] BLOQUEADO: ${error}`);
    process.exit(1);
  }

  const dbUrl = (env.PRODUCTION_DB_URL ?? "").trim();
  console.log(`[apply-migrations] Aplicando migraciones pendientes a production (${request.projectRef}).`);
  const result = runNpx(buildPushArgs(dbUrl));

  const stdout = redactDbUrl(result.stdout ?? "", dbUrl);
  const stderr = redactDbUrl(result.stderr ?? "", dbUrl);
  if (stdout.trim() !== "") console.log(stdout.trim());
  if (stderr.trim() !== "") console.error(stderr.trim());

  if (result.error) {
    console.error(`[apply-migrations] FALLO: no se pudo ejecutar el CLI (${result.error.name}).`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[apply-migrations] FALLO: supabase db push terminó con código ${result.status ?? "desconocido"}.`);
    process.exit(1);
  }
  console.log("[apply-migrations] supabase db push terminado. Ejecutar production-migration-gate para confirmar.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
