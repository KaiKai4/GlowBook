// Trinquete de tokens de diseño.
//
// Cuenta por archivo de src/ (*.ts, *.tsx, *.css, sin tests) cuatro categorías
// de valores que deberían venir de tokens semánticos (brand-*, choco-*, etc.):
//   - rawPalette: clases de paleta Tailwind cruda (p. ej. bg-red-500, text-slate-700/50)
//   - hex:        literales hex/rgb/hsl en clases arbitrarias [#...] o en className
//   - fontSize:   tamaños fuera de la escala corta (text-3xl+ y text-[12px])
//   - fontWeight: pesos fuera de normal/medium/semibold (font-bold, font-light, ...)
//   - invalid:    clases que empiezan por "undefined", "null" o "NaN" (ver design-token-classes.mjs)
//
// La baseline (quality/baselines/design-tokens.json) congela el recuento actual por
// archivo: ninguna cifra puede subir. Archivos nuevos deben tener 0 en todas.
// Una baseline sin la categoría "invalid" la trata como 0.
//
// Uso:
//   node scripts/quality/check-design-tokens.mjs
//   node scripts/quality/check-design-tokens.mjs --update-baseline
//   node scripts/quality/check-design-tokens.mjs --baseline-dir <dir>

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASS_NAME_ATTRIBUTE, countInvalidClassTokens } from "./design-token-classes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_DIR = "src";
const SCAN_EXTENSIONS = [".ts", ".tsx", ".css"];
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|mjs)$|^src\/test\//;
const BASELINE_FILE_NAME = "design-tokens.json";
/**
 * @typedef {{ rawPalette: number, hex: number, fontSize: number, fontWeight: number, invalid: number }} TokenCounts
 * @typedef {Record<string, TokenCounts>} Baseline
 */

/** @type {(keyof TokenCounts)[]} */
const CATEGORIES = ["rawPalette", "hex", "fontSize", "fontWeight", "invalid"];

// Paleta cruda: prefijo de utilidad + color de paleta Tailwind + tono opcional + opacidad opcional.
const RAW_PALETTE =
  /(?<![\w-])(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?(?![\w-])/g;
// Literales de color dentro de clases arbitrarias: bg-[#fff], [rgb(...)], [hsl(...)].
const ARBITRARY_COLOR = /\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\()/g;
// Literales de color sueltos dentro de className (sin corchete, que ya cuenta ARBITRARY_COLOR).
const LOOSE_HEX = /(?<!\[)#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])/g;
const LOOSE_FUNCTION = /(?<!\[)(?:rgba?|hsla?)\(/g;
// Tamaños fuera de la escala corta: text-3xl..text-9xl y text-[<n>px|rem|em].
const FONT_SIZE = /(?<![\w-])text-(?:[3-9]xl|\[\d*\.?\d+(?:px|rem|em)\])(?![\w-])/g;
// Pesos fuera de normal/medium/semibold.
const FONT_WEIGHT = /(?<![\w-])font-(?:thin|extralight|light|bold|extrabold|black)(?![\w-])/g;

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

/**
 * Recorre src/ y devuelve rutas relativas de archivos escaneables (sin tests).
 * @param {string} relativeDir
 * @param {string[]} out
 * @returns {string[]}
 */
function collectFiles(relativeDir, out) {
  const absoluteDir = path.join(ROOT, relativeDir);
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(relativePath, out);
    } else if (SCAN_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) && !TEST_FILE.test(relativePath)) {
      out.push(relativePath);
    }
  }
  return out;
}

/** @param {string} content @param {RegExp} pattern @returns {number} */
function countMatches(content, pattern) {
  return (content.match(pattern) ?? []).length;
}

/** @param {string} content @returns {number} */
function countHexInClassNames(content) {
  let total = 0;
  for (const match of content.matchAll(CLASS_NAME_ATTRIBUTE)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    total += countMatches(value, LOOSE_HEX) + countMatches(value, LOOSE_FUNCTION);
  }
  return total;
}

/** @param {string} content @returns {TokenCounts} */
export function countTokens(content) {
  return {
    rawPalette: countMatches(content, RAW_PALETTE),
    hex: countMatches(content, ARBITRARY_COLOR) + countHexInClassNames(content),
    fontSize: countMatches(content, FONT_SIZE),
    fontWeight: countMatches(content, FONT_WEIGHT),
    invalid: countInvalidClassTokens(content),
  };
}

/** @param {TokenCounts} counts @returns {boolean} */
function hasTokens(counts) {
  return CATEGORIES.some((category) => counts[category] > 0);
}

/** @param {string} filePath @returns {Baseline | null} */
function readBaseline(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  /** @type {Record<string, Partial<TokenCounts>>} */
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  /** @type {Baseline} */
  const data = {};
  for (const [file, counts] of Object.entries(raw)) {
    data[file] = { rawPalette: 0, hex: 0, fontSize: 0, fontWeight: 0, invalid: 0 };
    for (const category of CATEGORIES) {
      // Una baseline anterior puede no conocer una categoría nueva: cuenta como 0.
      const value = counts?.[category] ?? 0;
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Baseline inválida en ${file}: ${category} debe ser un entero >= 0`);
      }
      data[file][category] = value;
    }
  }
  return data;
}

/**
 * @template T
 * @param {Record<string, T>} source
 * @returns {Record<string, T>}
 */
function sortObject(source) {
  return Object.fromEntries(Object.entries(source).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** @param {string} filePath @param {Baseline} data @returns {void} */
function writeBaseline(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(sortObject(data), null, 2)}\n`, "utf8");
}

/**
 * Categorías cuyo recuento actual supera al de la baseline.
 * @param {TokenCounts} current
 * @param {TokenCounts} baselineCounts
 * @returns {(keyof TokenCounts)[]}
 */
function risingCategories(current, baselineCounts) {
  return CATEGORIES.filter((category) => current[category] > baselineCounts[category]);
}

/** @param {string} baselineFile @param {Baseline | null} baseline @param {Baseline} current @returns {number} */
function updateBaseline(baselineFile, baseline, current) {
  if (baseline === null) {
    writeBaseline(baselineFile, current);
    console.log(`Baseline creada con ${Object.keys(current).length} archivo(s): ${baselineFile}`);
    return 0;
  }
  /** @type {string[]} */
  const problems = [];
  for (const [file, counts] of Object.entries(current)) {
    if (!(file in baseline)) {
      problems.push(`nuevo: ${file} ${JSON.stringify(counts)}`);
    } else {
      for (const category of risingCategories(counts, baseline[file])) {
        problems.push(`sube: ${file} ${category} de ${baseline[file][category]} a ${counts[category]}`);
      }
    }
  }
  if (problems.length > 0) {
    console.error("No se reescribe la baseline: hay archivos nuevos con tokens crudos o cifras que suben.");
    for (const problem of problems) {
      console.error(`  ${problem}`);
    }
    return 1;
  }
  writeBaseline(baselineFile, current);
  console.log(`Baseline reescrita con ${Object.keys(current).length} archivo(s): ${baselineFile}`);
  return 0;
}

/** @param {Baseline} baseline @param {Map<string, TokenCounts>} scanned @param {Baseline} current @returns {{ failures: string[], notes: string[] }} */
function checkAgainstBaseline(baseline, scanned, current) {
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const notes = [];
  for (const [file, counts] of Object.entries(current)) {
    if (!(file in baseline)) {
      failures.push(`${file}: archivo nuevo con tokens crudos ${JSON.stringify(counts)}. Usa tokens semánticos.`);
      continue;
    }
    for (const category of risingCategories(counts, baseline[file])) {
      failures.push(`${file}: ${category} subió de ${baseline[file][category]} a ${counts[category]}.`);
    }
    for (const category of CATEGORIES) {
      if (counts[category] < baseline[file][category]) {
        notes.push(`${file}: ${category} bajó de ${baseline[file][category]} a ${counts[category]} (reduce la baseline con --update-baseline).`);
      }
    }
  }
  for (const file of Object.keys(baseline)) {
    const scannedCounts = scanned.get(file);
    if (!scannedCounts || !hasTokens(scannedCounts)) {
      failures.push(`${file}: en baseline pero sin tokens crudos o ya no existe. Regenera con --update-baseline.`);
    }
  }
  return { failures, notes };
}

/** @param {Map<string, TokenCounts>} scanned @returns {void} */
function printTotals(scanned) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const counts of scanned.values()) {
    for (const category of CATEGORIES) {
      totals[category] += counts[category];
    }
  }
  const summary = CATEGORIES.map((category) => `${category}=${totals[category]}`).join(", ");
  console.log(`Totales: ${summary}`);
}

/** @param {string[]} failures @param {string[]} notes @returns {void} */
function reportAndExit(failures, notes) {
  for (const note of notes) {
    console.log(`nota: ${note}`);
  }
  if (failures.length > 0) {
    console.error(`Tokens de diseño: ${failures.length} fallo(s).`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Tokens de diseño: OK.");
}

/** @returns {void} */
function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = collectFiles(SCAN_DIR, []);
  /** @type {Map<string, TokenCounts>} */
  const scanned = new Map();
  for (const file of files) {
    const counts = countTokens(readFileSync(path.join(ROOT, file), "utf8"));
    scanned.set(file, counts);
  }
  const current = Object.fromEntries([...scanned].filter(([, counts]) => hasTokens(counts)));

  printTotals(scanned);
  const baselineFile = path.join(options.baselineDir, BASELINE_FILE_NAME);
  const baseline = readBaseline(baselineFile);

  if (options.update) {
    process.exitCode = updateBaseline(baselineFile, baseline, current);
    return;
  }

  if (baseline === null) {
    const failures = Object.entries(current).map(
      ([file, counts]) => `${file}: tokens crudos ${JSON.stringify(counts)} y no hay baseline. Usa tokens semánticos o crea la baseline con --update-baseline.`,
    );
    reportAndExit(failures, []);
    return;
  }

  const { failures, notes } = checkAgainstBaseline(baseline, scanned, current);
  reportAndExit(failures, notes);
}

// Solo como CLI: importar el módulo (tests) no escanea ni escribe nada.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
