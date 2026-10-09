// Trinquete de tamaño de módulos.
//
// Regla: ningún archivo de src/ (*.ts, *.tsx) ni scripts/ (*.mjs) supera MAX_LINES
// líneas, salvo:
//   - excepciones permanentes justificadas en quality/module-size-exceptions.json
//     (p. ej. archivos generados), y
//   - deuda existente congelada en la baseline (quality/baselines/module-size.json):
//     un archivo congelado no puede crecer.
//
// Uso:
//   node scripts/quality/check-module-size.mjs
//   node scripts/quality/check-module-size.mjs --update-baseline
//   node scripts/quality/check-module-size.mjs --baseline-dir <dir>
//
// --update-baseline crea la baseline si no existe, o la reescribe solo si
// ningún valor sube y no se añaden archivos nuevos por encima del límite.
// --baseline-dir cambia el directorio de la baseline (pruebas, artefactos en .quality/).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {Record<string, number>} SizeMap
 * @typedef {{ path?: string, reason?: string }} ExceptionEntry
 */

const MAX_LINES = 300;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = [
  { dir: "src", extensions: [".ts", ".tsx"] },
  { dir: "scripts", extensions: [".mjs"] },
];
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mjs|js)$|^src\/test\//;
const EXCEPTIONS_FILE = path.join(ROOT, "quality", "module-size-exceptions.json");
const BASELINE_FILE_NAME = "module-size.json";

/** @param {string[]} argv @returns {{ update: boolean, baselineDir: string }} */
function parseArgs(argv) {
  const options = { update: false, baselineDir: path.join(ROOT, "quality", "baselines") };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--update-baseline") {
      options.update = true;
    } else if (arg === "--baseline-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--baseline-dir requiere una ruta");
      }
      options.baselineDir = path.resolve(process.cwd(), value);
      index += 1;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return options;
}

/** @param {string} relativePath @returns {string} */
function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

/** @param {string} relativeDir @param {string[]} extensions @param {string[]} out @returns {string[]} */
function collectFiles(relativeDir, extensions, out) {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!existsSync(absoluteDir)) {
    return out;
  }
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(relativePath, extensions, out);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      if (!TEST_FILE.test(relativePath)) {
        out.push(relativePath);
      }
    }
  }
  return out;
}

/** @param {string} content @returns {number} */
function countLines(content) {
  if (content === "") {
    return 0;
  }
  const lines = content.split(/\r?\n/).length;
  return content.endsWith("\n") ? lines - 1 : lines;
}

/**
 * @template T
 * @param {string} filePath
 * @returns {T | null}
 */
function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/** @returns {Set<string>} */
function loadExceptions() {
  /** @type {ExceptionEntry[] | null} */
  const parsed = readJsonFile(EXCEPTIONS_FILE);
  const entries = parsed ?? [];
  if (!Array.isArray(entries)) {
    throw new Error("quality/module-size-exceptions.json debe ser un array de { path, reason }");
  }
  /** @type {Set<string>} */
  const exceptions = new Set();
  for (const entry of entries) {
    if (typeof entry?.path !== "string" || typeof entry?.reason !== "string" || entry.reason.trim() === "") {
      throw new Error("Cada excepción necesita path y reason no vacío");
    }
    if (!existsSync(path.join(ROOT, entry.path))) {
      throw new Error(`Excepción obsoleta, el archivo no existe: ${entry.path}`);
    }
    exceptions.add(entry.path);
  }
  return exceptions;
}

/**
 * @template T
 * @param {Record<string, T>} source
 * @returns {Record<string, T>}
 */
function sortObject(source) {
  return Object.fromEntries(Object.entries(source).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** @param {string} filePath @param {SizeMap} data @returns {void} */
function writeBaseline(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(sortObject(data), null, 2)}\n`, "utf8");
}

/** @param {string} baselineFile @param {SizeMap | null} baseline @param {SizeMap} current @returns {number} */
function updateBaseline(baselineFile, baseline, current) {
  if (baseline === null) {
    writeBaseline(baselineFile, current);
    console.log(`Baseline creada con ${Object.keys(current).length} archivo(s): ${baselineFile}`);
    return 0;
  }
  const added = Object.keys(current).filter((file) => !(file in baseline));
  const rose = Object.keys(current).filter((file) => file in baseline && current[file] > baseline[file]);
  if (added.length > 0 || rose.length > 0) {
    console.error("No se reescribe la baseline: hay archivos nuevos por encima del límite o valores que suben.");
    for (const file of added) {
      console.error(`  nuevo: ${file} (${current[file]} líneas)`);
    }
    for (const file of rose) {
      console.error(`  sube: ${file} de ${baseline[file]} a ${current[file]} líneas`);
    }
    return 1;
  }
  writeBaseline(baselineFile, current);
  console.log(`Baseline reescrita con ${Object.keys(current).length} archivo(s): ${baselineFile}`);
  return 0;
}

/** @param {SizeMap} baseline @param {Map<string, number>} sizes @param {Set<string>} exceptions @param {SizeMap} current @returns {{ failures: string[], notes: string[] }} */
function checkAgainstBaseline(baseline, sizes, exceptions, current) {
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const notes = [];
  for (const [file, lines] of Object.entries(current)) {
    if (!(file in baseline)) {
      failures.push(`${file}: ${lines} líneas (> ${MAX_LINES}). Archivo nuevo: divídelo por responsabilidad.`);
    } else if (lines > baseline[file]) {
      failures.push(`${file}: creció de ${baseline[file]} a ${lines} líneas. La baseline no puede crecer.`);
    } else if (lines < baseline[file]) {
      notes.push(`${file}: bajó de ${baseline[file]} a ${lines} líneas (se puede reducir la baseline con --update-baseline).`);
    }
  }
  for (const [file, maxLines] of Object.entries(baseline)) {
    if (exceptions.has(file)) {
      failures.push(`${file}: está en excepciones y en baseline. Quítalo de la baseline con --update-baseline.`);
    } else if (!sizes.has(file)) {
      failures.push(`${file}: está en baseline pero ya no existe. Regenera con --update-baseline.`);
    } else {
      const size = sizes.get(file);
      if (size !== undefined && size <= MAX_LINES) {
        failures.push(`${file}: ${size} líneas (<= ${MAX_LINES}), baseline obsoleta (valor previo ${maxLines}). Regenera con --update-baseline.`);
      }
    }
  }
  return { failures, notes };
}

/** @returns {void} */
function main() {
  const options = parseArgs(process.argv.slice(2));
  const exceptions = loadExceptions();
  const files = SCAN_ROOTS.flatMap(({ dir, extensions }) => collectFiles(dir, extensions, []));

  /** @type {Map<string, number>} */
  const sizes = new Map();
  for (const file of files) {
    const relativePath = toPosix(file);
    sizes.set(relativePath, countLines(readFileSync(path.join(ROOT, file), "utf8")));
  }

  /** @type {SizeMap} */
  const current = {};
  for (const [file, lines] of sizes) {
    if (lines > MAX_LINES && !exceptions.has(file)) {
      current[file] = lines;
    }
  }

  const baselineFile = path.join(options.baselineDir, BASELINE_FILE_NAME);
  /** @type {SizeMap | null} */
  const baseline = readJsonFile(baselineFile);

  console.log(`Archivos analizados: ${sizes.size}. Excepciones permanentes: ${exceptions.size}. Límite: ${MAX_LINES} líneas.`);

  if (options.update) {
    process.exitCode = updateBaseline(baselineFile, baseline, current);
    return;
  }

  if (baseline === null) {
    const failures = Object.entries(current).map(
      ([file, lines]) => `${file}: ${lines} líneas (> ${MAX_LINES}) y no hay baseline. Divídelo o crea la baseline con --update-baseline.`,
    );
    reportAndExit(failures, []);
    return;
  }

  const { failures, notes } = checkAgainstBaseline(baseline, sizes, exceptions, current);
  reportAndExit(failures, notes);
}

/** @param {string[]} failures @param {string[]} notes @returns {void} */
function reportAndExit(failures, notes) {
  for (const note of notes) {
    console.log(`nota: ${note}`);
  }
  if (failures.length > 0) {
    console.error(`Tamaño de módulos: ${failures.length} fallo(s).`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Tamaño de módulos: OK.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
