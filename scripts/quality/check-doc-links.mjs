// Comprobador de enlaces y referencias de la documentación vigente.
//   (a) enlaces Markdown relativos ([texto](ruta)) deben apuntar a un fichero o carpeta existente;
//   (b) referencias en backticks a rutas del repo (docs/, src/, scripts/, supabase/, ...) deben existir.
// Alcance: README.md, AGENTS.md, CLAUDE.md, CONTEXT.md, PRODUCT.md, DESIGN.md, SECURITY.md y docs/**
// excepto docs/archive/ (histórico, no se mantiene). Se ignoran bloques de código con ``` y las
// rutas con comodines o placeholders (<mod>, *, {a,b}), porque no son rutas concretas.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ROOT_DOC_FILES = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "PRODUCT.md",
  "DESIGN.md",
  "SECURITY.md",
];
const DOCS_DIR = "docs";
const EXCLUDED_DIRS = ["docs/archive"];

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BACKTICK_PATH_RE = /`((?:docs|src|scripts|supabase|e2e|quality|security|\.github)\/[^`\s]+)`/g;
const PLACEHOLDER_RE = /[*<>{}]|\.\.\./;

/**
 * Quita el contenido de los bloques ``` (incluidas sus líneas de apertura y cierre).
 * @param {string} text
 * @returns {string}
 */
export function stripFences(text) {
  let inFence = false;
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

/**
 * Enlaces Markdown relativos (sin esquema, sin ancla pura y sin ruta absoluta de sitio).
 * @param {string} text texto ya sin bloques de código
 * @returns {string[]} destinos tal como aparecen, sin el ancla
 */
export function extractRelativeLinks(text) {
  const out = [];
  for (const match of text.matchAll(LINK_RE)) {
    const raw = match[1];
    if (/^(https?:|mailto:|tel:|#)/i.test(raw) || raw.startsWith("/")) continue;
    out.push(raw.split("#")[0]);
  }
  return out.filter((target) => target !== "");
}

/**
 * Rutas de repo citadas en backticks, sin comodines ni placeholders.
 * @param {string} text texto ya sin bloques de código
 * @returns {string[]}
 */
export function extractBacktickPaths(text) {
  const out = [];
  for (const match of text.matchAll(BACKTICK_PATH_RE)) {
    const candidate = match[1];
    if (PLACEHOLDER_RE.test(candidate)) continue;
    out.push(candidate.replace(/\/$/, ""));
  }
  return out;
}

/**
 * Comprueba un fichero de documentación.
 * @param {{ file: string, text: string, root?: string }} input ruta absoluta y contenido
 * @returns {{ broken: {from: string, link: string}[], missing: {from: string, path: string}[], linkCount: number, refCount: number }}
 */
export function checkDocText({ file, text, root = ROOT }) {
  const body = stripFences(text);
  const from = relative(root, file).split(sep).join("/");
  const links = extractRelativeLinks(body);
  const refs = extractBacktickPaths(body);
  const broken = links
    .filter((target) => !existsSync(resolve(dirname(file), safeDecode(target))))
    .map((link) => ({ from, link }));
  const missing = refs
    .filter((candidate) => !existsSync(resolve(root, candidate)))
    .map((path) => ({ from, path }));
  return { broken, missing, linkCount: links.length, refCount: refs.length };
}

/**
 * Lista los documentos vigentes a revisar (rutas absolutas).
 * @param {string} root raíz del repo
 * @returns {string[]}
 */
export function listDocFiles(root = ROOT) {
  const rootFiles = ROOT_DOC_FILES.map((name) => join(root, name)).filter((path) => existsSync(path));
  return [...rootFiles, ...collectMarkdown(join(root, DOCS_DIR), root, [])];
}

/**
 * @param {string} dir
 * @param {string} root
 * @param {string[]} out
 * @returns {string[]}
 */
function collectMarkdown(dir, root, out) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(root, abs).split(sep).join("/");
    if (EXCLUDED_DIRS.some((excluded) => rel === excluded || rel.startsWith(`${excluded}/`))) continue;
    if (statSync(abs).isDirectory()) {
      collectMarkdown(abs, root, out);
    } else if (entry.endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * @param {string} target
 * @returns {string}
 */
function safeDecode(target) {
  try {
    return decodeURI(target);
  } catch {
    return target;
  }
}

/**
 * Ejecuta la comprobación sobre todo el alcance.
 * @param {string} root
 * @returns {{ files: number, linkCount: number, refCount: number, broken: {from: string, link: string}[], missing: {from: string, path: string}[] }}
 */
export function checkAllDocs(root = ROOT) {
  const files = listDocFiles(root);
  const result = { files: files.length, linkCount: 0, refCount: 0, broken: [], missing: [] };
  for (const file of files) {
    const partial = checkDocText({ file, text: readFileSync(file, "utf8"), root });
    result.linkCount += partial.linkCount;
    result.refCount += partial.refCount;
    result.broken.push(...partial.broken);
    result.missing.push(...partial.missing);
  }
  return result;
}

function main() {
  const result = checkAllDocs(ROOT);
  console.log(`[check-doc-links] Ficheros revisados: ${result.files}`);
  console.log(`[check-doc-links] Enlaces relativos comprobados: ${result.linkCount}`);
  console.log(`[check-doc-links] Referencias de ruta en backticks comprobadas: ${result.refCount}`);
  if (result.broken.length > 0 || result.missing.length > 0) {
    console.error(`[check-doc-links] ERROR: ${result.broken.length} enlaces rotos y ${result.missing.length} rutas inexistentes:`);
    for (const b of result.broken) console.error(`  - enlace ${b.from} -> ${b.link}`);
    for (const m of result.missing) console.error(`  - referencia ${m.from} -> ${m.path}`);
    process.exit(1);
  }
  console.log("[check-doc-links] OK: 0 enlaces rotos y 0 rutas inexistentes.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
