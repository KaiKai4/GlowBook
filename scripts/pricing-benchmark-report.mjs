import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mb, round } from "./pricing-benchmark-shared.mjs";

/**
 * @typedef {{ table: string, bytes: number, mb: number }} FunctionalTable
 * @typedef {{ cohort: string, salons: number, estimatedMBPerSalon: number, estimatedMB: number }} CohortReport
 * @typedef {{ route: string, avgTransferMB: number, avgDurationMs: number, failures: number }} RouteReport
 * @typedef {{
 *   batchId: string,
 *   database: { bytes: number },
 *   benchmarkSalons: number,
 *   functionalMB: number,
 *   avgFunctionalMBPerSalon: number,
 *   functionalTables: FunctionalTable[],
 *   cohorts: CohortReport[],
 *   projections: unknown
 * }} DbReport
 */

/** @param {Buffer | string} output @returns {DbReport} */
function parseJsonOutput(output) {
  const raw = typeof output === "string" ? output : output.toString("utf8");
  const text = raw.trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Command did not emit JSON.");
  return JSON.parse(text.slice(start));
}

const db = parseJsonOutput(
  execFileSync(process.execPath, ["scripts/measure-pricing-benchmark.mjs"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })
);

/** @type {{ byRoute: RouteReport[] } | null} */
let routes = null;
if (process.env.PRICING_ROUTES_RESULT_FILE && existsSync(process.env.PRICING_ROUTES_RESULT_FILE)) {
  routes = JSON.parse(readFileSync(process.env.PRICING_ROUTES_RESULT_FILE, "utf8"));
}

const rankedTables = db.functionalTables
  .slice()
  .sort((a, b) => Number(b.bytes) - Number(a.bytes))
  .slice(0, 10)
  .map((table) => ({
    table: table.table,
    mb: table.mb,
  }));

const rankedCohorts = db.cohorts
  .slice()
  .sort((a, b) => b.estimatedMBPerSalon - a.estimatedMBPerSalon)
  .map((cohort) => ({
    cohort: cohort.cohort,
    salons: cohort.salons,
    estimatedMBPerSalon: cohort.estimatedMBPerSalon,
    estimatedMB: cohort.estimatedMB,
  }));

const routeSummary = routes
  ? routes.byRoute.slice(0, 10).map((route) => ({
      route: route.route,
      avgTransferMB: route.avgTransferMB,
      avgDurationMs: route.avgDurationMs,
      failures: route.failures,
    }))
  : [];

const estimatedMonthlyGrowth = rankedCohorts.map((cohort) => ({
  cohort: cohort.cohort,
  estimatedMonthlyGrowthMBPerSalon: round(cohort.estimatedMBPerSalon / 12, 3),
}));

const output = {
  batchId: db.batchId,
  generatedAt: new Date().toISOString(),
  database: db.database,
  benchmarkSalons: db.benchmarkSalons,
  functionalMB: db.functionalMB,
  avgFunctionalMBPerSalon: db.avgFunctionalMBPerSalon,
  topStorageTables: rankedTables,
  cohortsByEstimatedWeight: rankedCohorts,
  estimatedMonthlyGrowth,
  routeHotspots: routeSummary,
  projections: db.projections,
  pendingPricingDecisions: [
    "Definir planes solo despues de revisar costo por cohorte y rutas pesadas.",
    "Separar costo de recordatorios externos si se integra WhatsApp/SMS pago.",
    "Validar si colaboradores con acceso elevan consumo por sesiones y vistas propias.",
    "Decidir limites por clientes/citas/modulos despues de comparar margen objetivo.",
  ],
  notes: [
    "Los tamanos por cohorte son estimaciones por proporcion de filas sobre el tamano real de cada tabla.",
    routes ? "Incluye resultados de rutas desde PRICING_ROUTES_RESULT_FILE." : "No incluye rutas; ejecuta pricing:measure-routes con PRICING_ROUTES_OUTPUT para completar egress.",
    `DB total en MB: ${mb(db.database.bytes)}.`,
  ],
};

console.log(JSON.stringify(output, null, 2));
