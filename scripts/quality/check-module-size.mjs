// Límite absoluto de tamaño de módulos.
//
// Regla: ningún archivo de src/ (*.ts, *.tsx) ni scripts/ (*.mjs) supera MAX_LINES
// líneas. La única excepción es permanente y está justificada en
// quality/module-size-exceptions.json (p. ej. archivos generados). No hay baseline:
// si un archivo supera el límite, se divide por responsabilidad.
//
// Uso:
//   node scripts/quality/check-module-size.mjs

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{ path?: string, reason?: string }} ExceptionEntry
 */

export const MAX_LINES = 300;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = [
  { dir: "src", extensions: [".ts", ".tsx"] },
  { dir: "scripts", extensions: [".mjs"] },
];
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mjs|js)$|^src\/test\//;
const EXCEPTIONS_FILE = path.join(ROOT, "quality", "module-size-exceptions.json");

/**
 * Cuenta líneas de un archivo. Un salto final no genera línea extra.
 * @param {string} content
 * @returns {number}
 */
export function countLines(content) {
  if (content === "") {
    return 0;
  }
  const lines = content.split(/\r?\n/).length;
  return content.endsWith("\n") ? lines - 1 : lines;
}

/**
 * Archivos que superan el límite y no son excepción permanente.
 * @param {Map<string, number>} sizes ruta relativa (con "/") -> líneas
 * @param {Set<string>} exceptions rutas permanentemente excluidas
 * @param {number} [maxLines]
 * @returns {{ file: string, lines: number }[]} ordenado por ruta
 */
export function findOversizedFiles(sizes, exceptions, maxLines = MAX_LINES) {
  return [...sizes]
    .filter(([file, lines]) => lines > maxLines && !exceptions.has(file))
    .map(([file, lines]) => ({ file, lines }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * Valida el contenido de module-size-exceptions.json y devuelve las rutas.
 * @param {unknown} parsed
 * @param {(relativePath: string) => boolean} exists
 * @returns {Set<string>}
 */
export function parseExceptions(parsed, exists) {
  const entries = parsed ?? [];
  if (!Array.isArray(entries)) {
    throw new Error("quality/module-size-exceptions.json debe ser un array de { path, reason }");
  }
  /** @type {Set<string>} */
  const exceptions = new Set();
  for (const entry of /** @type {ExceptionEntry[]} */ (entries)) {
    if (typeof entry?.path !== "string" || typeof entry?.reason !== "string" || entry.reason.trim() === "") {
      throw new Error("Cada excepción necesita path y reason no vacío");
    }
    if (!exists(entry.path)) {
      throw new Error(`Excepción obsoleta, el archivo no existe: ${entry.path}`);
    }
    exceptions.add(entry.path);
  }
  return exceptions;
}

/**
 * @param {string} relativeDir
 * @param {string[]} extensions
 * @param {string[]} out
 * @returns {string[]}
 */
function collectFiles(relativeDir, extensions, out) {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!existsSync(absoluteDir)) {
    return out;
  }
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(relativePath, extensions, out);
    } else if (extensions.some((extension) => entry.name.endsWith(extension)) && !TEST_FILE.test(relativePath)) {
      out.push(relativePath);
    }
  }
  return out;
}

/** @returns {void} */
function main() {
  const exceptions = parseExceptions(
    existsSync(EXCEPTIONS_FILE) ? JSON.parse(readFileSync(EXCEPTIONS_FILE, "utf8")) : [],
    (relativePath) => existsSync(path.join(ROOT, relativePath)),
  );
  const files = SCAN_ROOTS.flatMap(({ dir, extensions }) => collectFiles(dir, extensions, []));

  /** @type {Map<string, number>} */
  const sizes = new Map();
  for (const file of files) {
    sizes.set(file, countLines(readFileSync(path.join(ROOT, file), "utf8")));
  }

  console.log(`Archivos analizados: ${sizes.size}. Excepciones permanentes: ${exceptions.size}. Límite: ${MAX_LINES} líneas.`);
  const oversized = findOversizedFiles(sizes, exceptions);
  if (oversized.length > 0) {
    console.error(`Tamaño de módulos: ${oversized.length} fallo(s).`);
    for (const { file, lines } of oversized) {
      console.error(`  - ${file}: ${lines} líneas (> ${MAX_LINES}). Divídelo por responsabilidad.`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Tamaño de módulos: OK.");
}

// Solo como CLI: importar el módulo (tests) no escanea nada.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
