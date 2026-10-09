// Cobertura del código cambiado: líneas modificadas (git diff + untracked)
// cruzadas con el informe istanbul (coverage/coverage-final.json).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, runArgv } from "./lib-process.mjs";

/**
 * @typedef {{ covered: number, total: number }} Counter
 * @typedef {{ lines: Counter, functions: Counter, branches: Counter }} CoverageCounts
 * @typedef {{ start?: { line?: number } }} IstanbulLocation
 * @typedef {{
 *   statementMap?: Record<string, { start: { line: number } }>,
 *   s?: Record<string, number>,
 *   fnMap?: Record<string, { decl?: IstanbulLocation, loc?: IstanbulLocation, line?: number }>,
 *   f?: Record<string, number>,
 *   branchMap?: Record<string, { loc?: IstanbulLocation, line?: number }>,
 *   b?: Record<string, number[]>
 * }} IstanbulFileEntry
 */

const CRITICAL_GLOBS = [
  "src/lib/auth/**",
  "src/lib/security/**",
  "src/features/access/**",
  "src/features/platform/**",
  "src/proxy*.ts",
];

/**
 * Compara un segmento de ruta con un patrón donde "*" cubre cualquier secuencia sin "/".
 * Algoritmo de dos punteros (sin RegExp dinámica).
 * @param {string} pattern
 * @param {string} segment
 * @returns {boolean}
 */
function matchSegment(pattern, segment) {
  let p = 0;
  let s = 0;
  let star = -1;
  let mark = 0;
  while (s < segment.length) {
    if (p < pattern.length && pattern[p] === segment[s]) {
      p += 1;
      s += 1;
    } else if (p < pattern.length && pattern[p] === "*") {
      star = p;
      mark = s;
      p += 1;
    } else if (star !== -1) {
      p = star + 1;
      mark += 1;
      s = mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === "*") p += 1;
  return p === pattern.length;
}

/**
 * Glob simple sobre rutas POSIX relativas: "**" cubre cero o más directorios y "*" un segmento parcial.
 * @param {string[]} globParts
 * @param {string[]} pathParts
 * @returns {boolean}
 */
function matchGlobParts(globParts, pathParts) {
  const [head, ...rest] = globParts;
  if (head === undefined) return pathParts.length === 0;
  if (head === "**") {
    for (let skip = 0; skip <= pathParts.length; skip += 1) {
      if (matchGlobParts(rest, pathParts.slice(skip))) return true;
    }
    return false;
  }
  const [segment, ...pathRest] = pathParts;
  return segment !== undefined && matchSegment(head, segment) && matchGlobParts(rest, pathRest);
}

/** @param {string} relativePath @returns {boolean} */
export function isCriticalPath(relativePath) {
  const pathParts = relativePath.split("/");
  return CRITICAL_GLOBS.some((glob) => matchGlobParts(glob.split("/"), pathParts));
}

/**
 * Solo código de aplicación: src/**\/*.ts(x) sin tests, sin src/test ni src/types.
 * @param {string} relativePath
 * @returns {boolean}
 */
export function isMeasuredSource(relativePath) {
  if (!/^src\/.+\.tsx?$/.test(relativePath)) return false;
  if (/\.test\.tsx?$/.test(relativePath)) return false;
  if (relativePath.startsWith("src/test/")) return false;
  if (relativePath.startsWith("src/types/")) return false;
  return true;
}

/**
 * Parsea la salida de `git diff -U0` y devuelve Map<archivo, Set<línea>>
 * con las líneas añadidas o modificadas en el lado nuevo.
 * @param {string} diffText
 * @returns {Map<string, Set<number>>}
 */
function parseChangedLines(diffText) {
  /** @type {Map<string, Set<number>>} */
  const changed = new Map();
  /** @type {string | null} */
  let currentFile = null;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      currentFile = target === "/dev/null" ? null : target.replace(/^b\//, "");
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || currentFile === null) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count === 0) continue;
    if (!changed.has(currentFile)) changed.set(currentFile, new Set());
    for (let offset = 0; offset < count; offset += 1) {
      changed.get(currentFile)?.add(start + offset);
    }
  }
  return changed;
}

/**
 * Métricas de un archivo istanbul restringidas a las líneas cambiadas.
 * Devuelve contadores { covered, total } por cada métrica.
 * @param {IstanbulFileEntry} entry
 * @param {Set<number>} changedLines
 * @returns {{ lines: Counter, functions: Counter, branches: Counter }}
 */
export function measureChangedLines(entry, changedLines) {
  /** @type {Map<number, number>} */
  const lineHits = new Map();
  for (const [id, location] of Object.entries(entry.statementMap ?? {})) {
    const line = location.start.line;
    if (!changedLines.has(line)) continue;
    const count = entry.s?.[id] ?? 0;
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, count));
  }

  const functions = { covered: 0, total: 0 };
  for (const [id, fn] of Object.entries(entry.fnMap ?? {})) {
    const line = fn.decl?.start?.line ?? fn.loc?.start?.line ?? fn.line;
    if (line === undefined || !changedLines.has(line)) continue;
    functions.total += 1;
    if ((entry.f?.[id] ?? 0) > 0) functions.covered += 1;
  }

  const branches = { covered: 0, total: 0 };
  for (const [id, branch] of Object.entries(entry.branchMap ?? {})) {
    const line = branch.loc?.start?.line ?? branch.line;
    if (line === undefined || !changedLines.has(line)) continue;
    for (const count of entry.b?.[id] ?? []) {
      branches.total += 1;
      if (count > 0) branches.covered += 1;
    }
  }

  const lines = { covered: 0, total: lineHits.size };
  for (const count of lineHits.values()) {
    if (count > 0) lines.covered += 1;
  }

  return { lines, functions, branches };
}

/** @param {Counter} counter @returns {number | null} */
export function percentage({ covered, total }) {
  if (total === 0) return null;
  return Math.round((covered / total) * 10000) / 100;
}

/**
 * Suma los contadores de `source` sobre `target` (muta `target`).
 * @param {CoverageCounts} target
 * @param {CoverageCounts} source
 * @returns {CoverageCounts}
 */
export function addCounts(target, source) {
  /** @type {Array<keyof CoverageCounts>} */
  const metrics = ["lines", "functions", "branches"];
  for (const metric of metrics) {
    target[metric].covered += source[metric].covered;
    target[metric].total += source[metric].total;
  }
  return target;
}

/** @returns {CoverageCounts} */
export function emptyCounts() {
  return {
    lines: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
  };
}

/** Normaliza las claves del informe (rutas absolutas) a rutas POSIX relativas. */
/** @param {string} key @returns {string} */
export function relativeCoverageKey(key) {
  const normalized = key.replace(/\\/g, "/");
  const root = ROOT.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

/** Líneas cambiadas en el working tree respecto a la base, más archivos nuevos. */
/** @param {string} baseRef @returns {Map<string, Set<number>>} */
export function collectChangedLines(baseRef) {
  const diff = runArgv(["git", "diff", "-U0", "--no-color", "--no-ext-diff", baseRef, "--"], {
    capture: true,
  });
  if (diff.status !== 0) {
    throw new Error(`git diff falló contra ${baseRef}: ${diff.stderr.trim()}`);
  }
  const changed = parseChangedLines(diff.stdout);

  const untracked = runArgv(["git", "ls-files", "--others", "--exclude-standard"], { capture: true });
  if (untracked.status !== 0) {
    throw new Error(`git ls-files falló: ${untracked.stderr.trim()}`);
  }
  for (const file of untracked.stdout.split(/\r?\n/).filter(Boolean)) {
    const relativePath = file.replace(/\\/g, "/");
    if (!isMeasuredSource(relativePath)) continue;
    const lineCount = readFileSync(join(ROOT, file), "utf8").split(/\r?\n/).length;
    const lines = new Set();
    for (let line = 1; line <= lineCount; line += 1) lines.add(line);
    changed.set(relativePath, lines);
  }
  return changed;
}

/** Resuelve la referencia base: QUALITY_BASE_REF, merge-base con origin/main, main o HEAD. */
/** @param {NodeJS.ProcessEnv} [env] @returns {string} */
export function resolveBaseRef(env = process.env) {
  if (env.QUALITY_BASE_REF) return env.QUALITY_BASE_REF;
  for (const candidate of [["merge-base", "HEAD", "origin/main"], ["merge-base", "HEAD", "main"]]) {
    const result = runArgv(["git", ...candidate], { capture: true });
    const sha = result.stdout.trim();
    if (result.status === 0 && sha) return sha;
  }
  return "HEAD";
}
