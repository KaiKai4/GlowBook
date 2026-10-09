// Runner de verificación de calidad de GlowBook.
//
// Uso:
//   node scripts/quality/verify.mjs --tier fast
//   node scripts/quality/verify.mjs --tier full            (fast + full)
//   node scripts/quality/verify.mjs --job unit             (cualquier tier)
//   node scripts/quality/verify.mjs --step lint --step unit
//   ... --keep-going                                       (no parar al primer fallo)
//
// Los filtros se combinan por unión. Los pasos se ejecutan en el orden del
// manifiesto (steps.mjs) y cada id se ejecuta una sola vez.
// Los pasos con needsDb levantan Supabase local una vez y reciben su entorno.
import { STEPS } from "./steps.mjs";
import { classifyRunResult, runArgvWithTimeout } from "./lib-process.mjs";

/**
 * @typedef {(typeof import("./steps.mjs").STEPS)[number]} Step
 * @typedef {{ tier: "fast" | "full" | null, jobs: string[], steps: string[], keepGoing: boolean }} ParsedArgs
 * @typedef {{ status: "ok" | "fail" | "timeout" | "skipped", exitCode: number | null, durationMs: number }} Outcome
 * @typedef {Outcome & { id: string, tier: "fast" | "full" }} Result
 * @typedef {Record<string, string>} TableRow
 */

const USAGE =
  "Uso: verify.mjs (--tier fast|full | --job <nombre> | --step <id>)... [--keep-going]";

/** @param {string[]} argv @returns {ParsedArgs} */
function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const options = { tier: null, jobs: [], steps: [], keepGoing: false };
  const tokens = [...argv];

  while (tokens.length > 0) {
    const token = tokens.shift();
    if (token === undefined) break;
    if (token === "--keep-going") {
      options.keepGoing = true;
      continue;
    }

    const match = /^--(tier|job|step)(?:=(.*))?$/.exec(token);
    if (!match) {
      throw new Error(`Argumento desconocido "${token}". ${USAGE}`);
    }
    const [, flag, inlineValue] = match;
    const value = inlineValue ?? tokens.shift();
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Falta valor para --${flag}. ${USAGE}`);
    }

    if (flag === "tier") {
      if (value !== "fast" && value !== "full") {
        throw new Error(`--tier debe ser fast o full, no "${value}".`);
      }
      options.tier = value;
    } else if (flag === "job") {
      options.jobs.push(value);
    } else {
      options.steps.push(value);
    }
  }

  return options;
}

/** @param {Omit<ParsedArgs, "keepGoing">} options @returns {Step[]} */
function selectSteps({ tier, jobs, steps }) {
  if (!tier && jobs.length === 0 && steps.length === 0) {
    throw new Error(USAGE);
  }

  const knownJobs = new Set(STEPS.flatMap((step) => step.jobs));
  for (const job of jobs) {
    if (!knownJobs.has(job)) {
      throw new Error(`Job desconocido "${job}". Jobs: ${[...knownJobs].join(", ")}`);
    }
  }
  const knownIds = new Set(STEPS.map((step) => step.id));
  for (const id of steps) {
    if (!knownIds.has(id)) {
      throw new Error(`Paso desconocido "${id}". Pasos: ${[...knownIds].join(", ")}`);
    }
  }

  // Unión de filtros, deduplicada, en el orden del manifiesto.
  return STEPS.filter((step) => {
    if (tier === "fast" && step.tier === "fast") return true;
    if (tier === "full") return true;
    if (jobs.some((job) => step.jobs.includes(job))) return true;
    if (steps.includes(step.id)) return true;
    return false;
  });
}

/** @type {Promise<Record<string, string>> | null} */
let dbEnvPromise = null;

/**
 * Levanta Supabase local una sola vez y devuelve el entorno a mezclar.
 * @returns {Promise<Record<string, string>>}
 */
function loadDbEnv() {
  if (!dbEnvPromise) {
    dbEnvPromise = (async () => {
      const supabaseEnv = await import("./supabase-env.mjs");
      await supabaseEnv.ensureLocalSupabase();
      return supabaseEnv.getLocalSupabaseEnv();
    })();
  }
  return dbEnvPromise;
}

/** @param {Step} step @returns {Promise<NodeJS.ProcessEnv>} */
async function envForStep(step) {
  if (!step.needsDb) return process.env;
  const localEnv = await loadDbEnv();
  return { ...process.env, ...localEnv };
}

/** @param {number} ms @returns {string} */
function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** @param {Result[]} results @returns {void} */
function printSummary(results) {
  /** @type {TableRow[]} */
  const rows = results.map((result) => ({
    id: result.id,
    tier: result.tier,
    status: result.status,
    duration: result.status === "skipped" ? "-" : formatDuration(result.durationMs),
    exit: result.exitCode === null ? "-" : String(result.exitCode),
  }));
  /** @type {TableRow} */
  const headers = { id: "paso", tier: "tier", status: "estado", duration: "duración", exit: "exit" };
  /** @type {Record<string, number>} */
  const widths = Object.fromEntries(
    Object.keys(headers).map((key) =>
      [key, Math.max(headers[key].length, ...rows.map((row) => row[key].length))]
    )
  );
  const line = (/** @type {TableRow} */ row) =>
    Object.keys(headers).map((key) => row[key].padEnd(widths[key])).join("  ");

  console.log("\nResumen de verificación");
  console.log(line(headers));
  console.log(Object.keys(headers).map((key) => "-".repeat(widths[key])).join("  "));
  for (const row of rows) console.log(line(row));
}

/** @param {Step} step @returns {Promise<Outcome>} */
async function runStep(step) {
  const startedAt = Date.now();
  console.log(`\n=== [${step.id}] ${step.description}`);

  /** @type {NodeJS.ProcessEnv} */
  let env;
  try {
    env = await envForStep(step);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[verify] No se pudo preparar Supabase local para "${step.id}": ${message}`);
    return { status: "fail", exitCode: 1, durationMs: Date.now() - startedAt };
  }

  const result = await runArgvWithTimeout(step.cmd, { env, timeoutMs: step.timeoutMs });
  const durationMs = Date.now() - startedAt;
  const status = classifyRunResult(result);
  if (status === "timeout") {
    console.error(
      `[verify] "${step.id}" superó el límite de ${step.timeoutMs / 60000} min: se terminó el proceso y sus hijos. ` +
        "Si se repite, busca un proceso colgado (p. ej. un stack de Supabase arrancado por otro checkout)."
    );
    return { status, exitCode: null, durationMs };
  }
  if (result.error) {
    console.error(`[verify] No se pudo ejecutar "${step.cmd[0]}": ${result.error.message}`);
    return { status: "fail", exitCode: 1, durationMs };
  }
  return { status, exitCode: result.status ?? 1, durationMs };
}

/** @returns {Promise<void>} */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selected = selectSteps(options);

  /** @type {Result[]} */
  const results = [];
  let stopped = false;
  for (const step of selected) {
    if (stopped) {
      results.push({ id: step.id, tier: step.tier, status: "skipped", exitCode: null, durationMs: 0 });
      continue;
    }
    const outcome = await runStep(step);
    results.push({ id: step.id, tier: step.tier, ...outcome });
    if (outcome.status !== "ok" && !options.keepGoing) {
      stopped = true;
    }
  }

  printSummary(results);
  const failed = results.filter((result) => result.status === "fail" || result.status === "timeout");
  if (failed.length > 0) {
    console.error(`\n[verify] Fallaron: ${failed.map((result) => result.id).join(", ")}`);
    process.exit(1);
  }
  console.log("\n[verify] Todos los pasos seleccionados pasaron.");
}

main().catch((error) => {
  console.error(`[verify] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
