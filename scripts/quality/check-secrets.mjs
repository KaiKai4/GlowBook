// Escaneo de secretos con secretlint sobre los archivos de git
// (rastreados y no ignorados). Se procesa por lotes para no exceder el
// límite de longitud de la línea de comandos de Windows.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, runArgv } from "./lib-process.mjs";
import { assertSecretlintPreset } from "./secretlint-preset.mjs";

// Presupuesto de caracteres por lote (rutas + separadores). Windows limita la
// línea de comandos a ~32 767 caracteres y npm añade su propia envoltura.
const MAX_BATCH_CHARS = 6000;

/**
 * Lista archivos de git (rastreados y no ignorados) que existen en disco.
 * @returns {string[]}
 */
function listGitFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error(`git ls-files falló: ${result.stderr || result.error?.message || "sin detalle"}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter((file) => file.length > 0)
    // Un archivo rastreado borrado en el working tree no se puede escanear.
    .filter((file) => existsSync(join(ROOT, file)));
}

/**
 * Parte rutas en lotes cuyo total de caracteres no supera `maxChars`.
 * Un único archivo más largo que el presupuesto va solo en su lote.
 * @param {string[]} items
 * @param {number} maxChars
 * @returns {string[][]}
 */
function chunkByLength(items, maxChars) {
  /** @type {string[][]} */
  const batches = [];
  /** @type {string[]} */
  let current = [];
  let currentChars = 0;
  for (const item of items) {
    const cost = item.length + 1;
    if (current.length > 0 && currentChars + cost > maxChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += cost;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

assertSecretlintPreset();
const files = listGitFiles();
if (files.length === 0) {
  console.log("[secrets] No hay archivos de git que escanear.");
  process.exit(0);
}

let failures = 0;
const batches = chunkByLength(files, MAX_BATCH_CHARS);
for (const [index, batch] of batches.entries()) {
  const result = runArgv(["npm", "run", "-s", "secretlint", "--", ...batch], { capture: true });
  if (result.error) {
    console.error(`[secrets] No se pudo ejecutar el script npm secretlint: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    failures += 1;
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    console.error(`[secrets] Lote ${index + 1}/${batches.length} con hallazgos.`);
  }
}

if (failures > 0) {
  console.error(`[secrets] Hallazgos en ${failures} lote(s) de ${batches.length}. Revisa la salida anterior.`);
  process.exit(1);
}
console.log(`[secrets] ${files.length} archivo(s) escaneados sin hallazgos (${batches.length} lote(s)).`);
