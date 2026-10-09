// Aplicacion de migraciones con guardia (wrapper de "supabase db push").
//
// Solo se ejecuta en automatizacion de release explicita:
//   GLOWBOOK_RELEASE_AUTOMATION=true
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
//   node scripts/db-push-guarded.mjs --confirm=<ref>
//
// Comprueba que --confirm coincide con el project-ref del destino y que el proyecto
// enlazado por la CLI (supabase/.temp/project-ref) es el mismo. No imprime la URL ni credenciales.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TargetGuardError, assertReleaseAutomation, readConfirmFlag } from "./lib/target-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LINKED_REF_FILE = path.join(ROOT, "supabase", ".temp", "project-ref");

/**
 * Lee el project-ref enlazado por "supabase link", o null si no existe.
 * @returns {string | null}
 */
function readLinkedRef() {
  if (!existsSync(LINKED_REF_FILE)) return null;
  const value = readFileSync(LINKED_REF_FILE, "utf8").trim();
  return value.length > 0 ? value : null;
}

/** @returns {number} */
function main() {
  try {
    const { ref } = assertReleaseAutomation({
      releaseAutomation: process.env.GLOWBOOK_RELEASE_AUTOMATION,
      confirmFlag: readConfirmFlag(process.argv),
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      linkedRef: readLinkedRef(),
    });
    console.log(`[db-push-guarded] Destino confirmado: proyecto ${ref}. Aplicando migraciones pendientes.`);
  } catch (error) {
    if (!(error instanceof TargetGuardError)) throw error;
    console.error(`[db-push-guarded] ${error.message}`);
    return 1;
  }

  const result = spawnSync("npx", ["supabase", "db", "push"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`[db-push-guarded] No se pudo ejecutar supabase db push: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

process.exit(main());
