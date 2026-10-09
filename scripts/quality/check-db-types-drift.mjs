// Detecta deriva entre los tipos versionados (src/types/database.types.ts) y los que genera
// la base LOCAL a partir de las migraciones del repo. NO regenera el archivo versionado:
// si hay diferencias, falla con un resumen del diff (.quality/database-types.diff tiene el completo).
//
// Comparacion canonica: se imprime el AST con el printer de TypeScript (mismo formato para ambos)
// y se normalizan solo diferencias de presentacion (comillas de claves, comas finales, parentesis
// redundantes). Cualquier diferencia de tipos o de columnas sigue contando como drift.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ensureLocalSupabase } from "./supabase-env.mjs";
import { DATABASE_TYPES_PATH, generateLocalDatabaseTypes } from "./generate-db-types.mjs";

const require = createRequire(import.meta.url);
/** @type {typeof import("typescript")} */
const ts = require("typescript");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ARTIFACT_DIR = path.join(ROOT, ".quality");
const GENERATED_PATH = path.join(ARTIFACT_DIR, "database.types.ts");
const DIFF_PATH = path.join(ARTIFACT_DIR, "database-types.diff");
const SUMMARY_LINES = 60;

/** @param {string} filePath @returns {string} */
function readNormalized(filePath) {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

/**
 * Imprime el AST con el printer de TypeScript y normaliza diferencias de presentación.
 * @param {string} text
 * @returns {string}
 */
function canonicalize(text) {
  const sourceFile = ts.createSourceFile("database.types.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printed = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true })
    .printFile(sourceFile);

  return printed
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"(\??):/g, "$1$2:")
    .replace(/'([^'\n]*)'/g, '"$1"')
    .replace(/\((\w+)\)\[\]/g, "$1[]")
    .replace(/,(\s*\n\s*[}\]])/g, "$1");
}

// Diff por lineas (LCS). Devuelve lineas con prefijo "+", "-" o " ".
/** @param {string[]} oldLines @param {string[]} newLines @returns {string[]} */
function lineDiff(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;
  /** @type {Uint32Array[]} */
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] =
        oldLines[i] === newLines[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  /** @type {string[]} */
  const output = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      output.push(` ${oldLines[i]}`);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      output.push(`-${oldLines[i]}`);
      i += 1;
    } else {
      output.push(`+${newLines[j]}`);
      j += 1;
    }
  }
  while (i < n) output.push(`-${oldLines[i++]}`);
  while (j < m) output.push(`+${newLines[j++]}`);
  return output;
}

/** @returns {Promise<number>} */
async function main() {
  await ensureLocalSupabase();

  const generated = generateLocalDatabaseTypes();
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(GENERATED_PATH, generated, "utf8");

  const versioned = readNormalized(DATABASE_TYPES_PATH);
  const versionedCanonical = canonicalize(versioned);
  const generatedCanonical = canonicalize(generated.replace(/\r\n/g, "\n"));

  if (versionedCanonical === generatedCanonical) {
    console.log("Sin drift: src/types/database.types.ts coincide con las migraciones locales.");
    return 0;
  }

  const diff = lineDiff(versionedCanonical.split("\n"), generatedCanonical.split("\n"));
  const changed = diff.filter((line) => line.startsWith("+") || line.startsWith("-"));
  const added = changed.filter((line) => line.startsWith("+")).length;
  const removed = changed.length - added;
  writeFileSync(DIFF_PATH, diff.join("\n"), "utf8");

  console.error(
    `Drift entre src/types/database.types.ts (versionado) y la base local: +${added} / -${removed} lineas canonicas.`
  );
  console.error("Diff resumido (- versionado, + generado desde migraciones locales):");
  for (const line of changed.slice(0, SUMMARY_LINES)) console.error(line);
  if (changed.length > SUMMARY_LINES) {
    console.error(`... ${changed.length - SUMMARY_LINES} lineas mas en ${path.relative(ROOT, DIFF_PATH)}`);
  }
  console.error("El archivo versionado NO se ha regenerado. Revisa el drift antes de cambiarlo.");
  return 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
