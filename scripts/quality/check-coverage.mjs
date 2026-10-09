// Gate de cobertura de GlowBook.
//   (a) Trinquete global: lines/functions/branches/statements totales no pueden
//       bajar respecto a quality/coverage-baseline.json (tolerancia 0, 2 decimales).
//   (b) Código cambiado: líneas modificadas frente a la base (QUALITY_BASE_REF,
//       merge-base con origin/main, main o HEAD) deben cumplir umbrales.
//       General 80/80/70 (líneas/funciones/ramas); rutas críticas 90/90/80.
//
// Uso:
//   node scripts/quality/check-coverage.mjs           solo comprueba (requiere coverage/)
//   node scripts/quality/check-coverage.mjs --run     ejecuta vitest --coverage antes
//   node scripts/quality/check-coverage.mjs --update  escribe la baseline (nunca la baja)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, runArgv } from "./lib-process.mjs";
import {
  addCounts,
  collectChangedLines,
  emptyCounts,
  isCriticalPath,
  isMeasuredSource,
  measureChangedLines,
  percentage,
  relativeCoverageKey,
  resolveBaseRef,
} from "./lib-coverage-changed.mjs";

/**
 * @typedef {import("./lib-coverage-changed.mjs").CoverageCounts} CoverageCounts
 * @typedef {import("./lib-coverage-changed.mjs").IstanbulFileEntry} IstanbulFileEntry
 * @typedef {"lines" | "functions" | "branches"} CoverageMetric
 * @typedef {CoverageMetric | "statements"} TotalMetric
 * @typedef {Partial<Record<TotalMetric, number>>} Baseline
 * @typedef {{ total?: Partial<Record<TotalMetric, { pct?: number }>> }} CoverageSummary
 * @typedef {"general" | "critical"} ChangedGroup
 * @typedef {{ file: string, group: ChangedGroup, counts: CoverageCounts }} FileReport
 * @typedef {{ groups: Record<ChangedGroup, CoverageCounts>, perFile: FileReport[] }} ChangeReport
 */

const COVERAGE_SUMMARY_PATH = join(ROOT, "coverage", "coverage-summary.json");
const COVERAGE_FINAL_PATH = join(ROOT, "coverage", "coverage-final.json");
const BASELINE_PATH = join(ROOT, "quality", "coverage-baseline.json");

/** @type {TotalMetric[]} */
const TOTAL_METRICS = ["lines", "functions", "branches", "statements"];
/** @type {Record<CoverageMetric, number>} */
const GENERAL_THRESHOLDS = { lines: 80, functions: 80, branches: 70 };
/** @type {Record<CoverageMetric, number>} */
const CRITICAL_THRESHOLDS = { lines: 90, functions: 90, branches: 80 };

/** @param {number} value @returns {number} */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Lee y parsea un JSON; lanza un error con contexto si falta o no es válido.
 * @template T
 * @param {string} path
 * @param {string} description
 * @returns {T}
 */
function readJson(path, description) {
  if (!existsSync(path)) {
    throw new Error(`No existe ${description} (${path}). Ejecuta con --run o npm run test:coverage.`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer ${description}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Totales del informe json-summary, redondeados a 2 decimales. */
/** @param {CoverageSummary} summary @returns {Record<TotalMetric, number>} */
export function readTotals(summary) {
  const totals = { lines: 0, functions: 0, branches: 0, statements: 0 };
  for (const metric of TOTAL_METRICS) {
    const pct = summary.total?.[metric]?.pct;
    if (typeof pct !== "number") {
      throw new Error(`coverage-summary.json no contiene total.${metric}.pct.`);
    }
    totals[metric] = round2(pct);
  }
  return totals;
}

/** Errores de trinquete: cualquier métrica por debajo de su baseline. */
/** @param {Record<TotalMetric, number>} current @param {Baseline} baseline @returns {string[]} */
export function compareWithBaseline(current, baseline) {
  return TOTAL_METRICS.filter((metric) => {
    const floor = baseline[metric];
    return floor !== undefined && current[metric] < floor;
  }).map(
    (metric) => `cobertura global de ${metric} bajó: ${current[metric]}% < baseline ${baseline[metric]}%`
  );
}

/**
 * --update: escribe la baseline si no existe o si ninguna métrica baja.
 * Devuelve un mensaje o lanza si hay una regresión.
 */
/** @param {Record<TotalMetric, number>} current @param {Baseline | null} existing @returns {{ write: boolean, reason: string }} */
export function decideBaselineUpdate(current, existing) {
  if (existing === null) return { write: true, reason: "no existía baseline" };
  const regressions = compareWithBaseline(current, existing);
  if (regressions.length > 0) {
    throw new Error(`No se actualiza la baseline: ${regressions.join("; ")}`);
  }
  return { write: true, reason: "las métricas suben o se mantienen" };
}

/** @param {Record<TotalMetric, number>} totals @returns {void} */
function writeBaseline(totals) {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  const document = { generatedBy: "scripts/quality/check-coverage.mjs --update", ...totals };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

/** @param {Record<string, IstanbulFileEntry>} finalReport @param {Map<string, Set<number>>} changed @returns {ChangeReport} */
function evaluateChanged(finalReport, changed) {
  /** @type {Record<ChangedGroup, CoverageCounts>} */
  const groups = { general: emptyCounts(), critical: emptyCounts() };
  /** @type {FileReport[]} */
  const perFile = [];
  /** @type {Map<string, IstanbulFileEntry>} */
  const coveredKeys = new Map();
  for (const [key, entry] of Object.entries(finalReport)) {
    coveredKeys.set(relativeCoverageKey(key), entry);
  }

  for (const [file, lines] of changed) {
    if (!isMeasuredSource(file)) continue;
    const group = isCriticalPath(file) ? "critical" : "general";
    const entry = coveredKeys.get(file);
    /** @type {CoverageCounts} */
    let counts;
    if (entry) {
      counts = measureChangedLines(entry, lines);
    } else {
      // Sin datos de cobertura: cada línea cambiada cuenta como no cubierta.
      counts = emptyCounts();
      counts.lines = { covered: 0, total: lines.size };
    }
    if (counts.lines.total === 0 && counts.functions.total === 0 && counts.branches.total === 0) {
      continue;
    }
    addCounts(groups[group], counts);
    perFile.push({ file, group, counts });
  }
  return { groups, perFile };
}

/** @param {ChangedGroup} group @returns {Record<CoverageMetric, number>} */
function thresholdsFor(group) {
  return group === "critical" ? CRITICAL_THRESHOLDS : GENERAL_THRESHOLDS;
}

/** @param {ChangedGroup} group @param {CoverageCounts} counts @returns {string[]} */
function checkGroup(group, counts) {
  /** @type {string[]} */
  const failures = [];
  const thresholds = thresholdsFor(group);
  for (const metric of /** @type {CoverageMetric[]} */ (["lines", "functions", "branches"])) {
    const value = percentage(counts[metric]);
    if (value === null) continue;
    if (value < thresholds[metric]) {
      failures.push(`${group} ${metric} ${value}% < ${thresholds[metric]}%`);
    }
  }
  return failures;
}

/** @param {CoverageCounts} counts @returns {string} */
function formatPct(counts) {
  const fmt = (/** @type {CoverageMetric} */ metric) => {
    const value = percentage(counts[metric]);
    return value === null ? "n/a" : `${value}%`;
  };
  return `líneas ${fmt("lines")} | funciones ${fmt("functions")} | ramas ${fmt("branches")}`;
}

/** @param {ChangeReport} report @returns {string[]} */
function reportChanged(report) {
  /** @type {string[]} */
  const failures = [];
  for (const group of /** @type {ChangedGroup[]} */ (["general", "critical"])) {
    const counts = report.groups[group];
    const measurable = counts.lines.total + counts.functions.total + counts.branches.total;
    if (measurable === 0) {
      console.log(`[coverage] Código cambiado (${group}): sin líneas medibles.`);
      continue;
    }
    console.log(`[coverage] Código cambiado (${group}): ${formatPct(counts)}`);
    failures.push(...checkGroup(group, counts));
  }

  const below = report.perFile.filter((item) => {
    const thresholds = thresholdsFor(item.group);
    return /** @type {CoverageMetric[]} */ (["lines", "functions", "branches"]).some((metric) => {
      const value = percentage(item.counts[metric]);
      return value !== null && value < thresholds[metric];
    });
  });
  if (below.length > 0) {
    console.log("[coverage] Archivos cambiados por debajo del umbral:");
    for (const item of below) {
      console.log(`  - ${item.file} [${item.group}] ${formatPct(item.counts)}`);
    }
  }
  return failures;
}

/** @returns {void} */
function main() {
  const flags = new Set(process.argv.slice(2));
  if (flags.has("--run")) {
    const run = runArgv(["vitest", "run", "--coverage"]);
    if (run.error) throw new Error(`No se pudo ejecutar vitest: ${run.error.message}`);
    if (run.status !== 0) process.exit(run.status ?? 1);
  }

  const current = readTotals(readJson(COVERAGE_SUMMARY_PATH, "coverage/coverage-summary.json"));
  console.log(`[coverage] Global: ${TOTAL_METRICS.map((metric) => `${metric} ${current[metric]}%`).join(" | ")}`);

  if (flags.has("--update")) {
    /** @type {Baseline | null} */
    const existing = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : null;
    const decision = decideBaselineUpdate(current, existing);
    writeBaseline(current);
    console.log(`[coverage] Baseline escrita (${decision.reason}).`);
    return;
  }

  /** @type {string[]} */
  const failures = [];
  if (!existsSync(BASELINE_PATH)) {
    failures.push("falta quality/coverage-baseline.json; créala con --update");
  } else {
    /** @type {Baseline} */
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    failures.push(...compareWithBaseline(current, baseline));
  }

  const baseRef = resolveBaseRef();
  console.log(`[coverage] Base para código cambiado: ${baseRef}`);
  const changed = collectChangedLines(baseRef);
  /** @type {Record<string, IstanbulFileEntry>} */
  const finalReport = readJson(COVERAGE_FINAL_PATH, "coverage/coverage-final.json");
  const report = evaluateChanged(finalReport, changed);

  const hasMeasurable = [report.groups.general, report.groups.critical].some(
    (counts) => counts.lines.total + counts.functions.total + counts.branches.total > 0
  );
  if (!hasMeasurable) {
    console.log("[coverage] No hay líneas cambiadas medibles en src/: se omite el umbral de cambio.");
  } else {
    failures.push(...reportChanged(report));
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`[coverage] ${failure}`);
    console.error("[coverage] FALLO.");
    process.exit(1);
  }
  console.log("[coverage] OK.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[coverage] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
