// Genera los tipos TypeScript de la base de datos LOCAL (Docker) con "supabase gen types".
// Uso directo (npm run db:types): escribe src/types/database.types.ts desde Supabase local.
// Nunca usa staging ni producción. Al importarse solo exporta funciones (sin efectos).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { ensureLocalSupabase } from "./supabase-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI_ENTRY = path.join(ROOT, "node_modules", "supabase", "dist", "supabase.js");
export const DATABASE_TYPES_PATH = path.join(ROOT, "src", "types", "database.types.ts");

// Mismos schemas que el archivo versionado (solo public).
const SCHEMAS = ["public"];

/**
 * Formatea TypeScript de tipos de base de datos de forma determinista: imprime el AST con el
 * printer de TypeScript (objetos multilínea, sin comentarios) y normaliza solo diferencias de
 * presentación (comillas de claves, comillas simples, comas finales). Idempotente.
 * @param {string} text
 * @returns {string}
 */
export function formatDatabaseTypes(text) {
  const source = text.replace(/\r\n/g, "\n");
  const sourceFile = ts.createSourceFile("database.types.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printed = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true })
    .printFile(sourceFile);

  const normalized = printed
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"(\??):/g, "$1$2:")
    .replace(/'([^'\n]*)'/g, '"$1"')
    .replace(/\((\w+)\)\[\]/g, "$1[]")
    .replace(/,(\s*\n\s*[}\]])/g, "$1");
  return `${normalized.replace(/\n*$/, "")}\n`;
}

/**
 * Indica si dos textos de tipos son equivalentes tras formatear ambos (EOL y presentación ignorados).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameDatabaseTypes(a, b) {
  return formatDatabaseTypes(a) === formatDatabaseTypes(b);
}

/**
 * Valida que la salida de "supabase gen types" contiene el tipo Database.
 * @param {string} output
 * @returns {string} la misma salida si es válida
 */
export function assertDatabaseTypesOutput(output) {
  if (!output.includes("export type Database")) {
    throw new Error("La salida de \"supabase gen types\" no contiene el tipo Database.");
  }
  return output;
}

// Devuelve el TypeScript generado desde la base local (formateado), sin escribir nada.
export function generateLocalDatabaseTypes() {
  const result = spawnSync(
    process.execPath,
    [CLI_ENTRY, "gen", "types", "typescript", "--local", "--schema", SCHEMAS.join(",")],
    { cwd: ROOT, encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
  );

  if (result.error || result.status !== 0) {
    const stderr = (result.stderr ?? "").trim().slice(-1500);
    throw new Error(`No se pudieron generar los tipos desde Supabase local.\n${stderr}`);
  }

  return formatDatabaseTypes(assertDatabaseTypesOutput(result.stdout ?? ""));
}

async function main() {
  await ensureLocalSupabase();
  const types = generateLocalDatabaseTypes();
  writeFileSync(DATABASE_TYPES_PATH, types, "utf8");
  console.log(`Tipos generados desde la base LOCAL en ${path.relative(ROOT, DATABASE_TYPES_PATH)}.`);
}

const isDirectRun = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
