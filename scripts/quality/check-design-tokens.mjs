// Control absoluto de tokens de diseño.
//
// Cuenta por archivo de src/ (*.ts, *.tsx, *.css, sin tests) cinco categorías
// de valores que deben venir de tokens semánticos (brand-*, choco-*, etc.):
//   - rawPalette: clases de paleta Tailwind cruda (p. ej. bg-red-500, text-slate-700/50)
//   - hex:        literales hex/rgb/hsl en clases arbitrarias [#...] o en className
//   - fontSize:   tamaños fuera de la escala corta (text-3xl+ y text-[12px])
//   - fontWeight: pesos fuera de normal/medium/semibold (font-bold, font-light, ...)
//   - invalid:    clases que empiezan por "undefined", "null" o "NaN" (ver design-token-classes.mjs)
//
// No hay baseline: cualquier ocurrencia en cualquier archivo de src/ falla.
// La corrección es usar tokens semánticos, nunca congelar el recuento.
//
// Uso:
//   node scripts/quality/check-design-tokens.mjs

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASS_NAME_ATTRIBUTE, countInvalidClassTokens } from "./design-token-classes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_DIR = "src";
const SCAN_EXTENSIONS = [".ts", ".tsx", ".css"];
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|mjs)$|^src\/test\//;

/**
 * @typedef {{ rawPalette: number, hex: number, fontSize: number, fontWeight: number, invalid: number }} TokenCounts
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

/**
 * Recorre src/ y devuelve rutas relativas de archivos escaneables (sin tests).
 * @param {string} relativeDir
 * @param {string[]} out
 * @returns {string[]}
 */
function collectFiles(relativeDir, out) {
  for (const entry of readdirSync(path.join(ROOT, relativeDir), { withFileTypes: true })) {
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

/** @returns {void} */
function main() {
  /** @type {Map<string, TokenCounts>} */
  const scanned = new Map();
  for (const file of collectFiles(SCAN_DIR, [])) {
    scanned.set(file, countTokens(readFileSync(path.join(ROOT, file), "utf8")));
  }

  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const counts of scanned.values()) {
    for (const category of CATEGORIES) {
      totals[category] += counts[category];
    }
  }
  console.log(`Totales: ${CATEGORIES.map((category) => `${category}=${totals[category]}`).join(", ")}`);

  const offenders = [...scanned].filter(([, counts]) => hasTokens(counts));
  if (offenders.length > 0) {
    console.error(`Tokens de diseño: ${offenders.length} archivo(s) con valores crudos.`);
    for (const [file, counts] of offenders) {
      console.error(`  - ${file}: ${JSON.stringify(counts)}. Usa tokens semánticos.`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Tokens de diseño: OK.");
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
