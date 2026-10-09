// Lógica pura del gate de release (sin I/O). Ver docs/runbooks/deploy.md.
// El gate nunca se salta: si falta un secreto o un check-run no está en
// success, la release falla.

/**
 * Secretos que deben existir (no vacíos) antes de cualquier etapa de release.
 * Son nombres de secretos del repositorio o del environment; nunca se imprimen
 * sus valores.
 */
export const REQUIRED_SECRETS = Object.freeze([
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "SUPABASE_ACCESS_TOKEN",
  "PRODUCTION_DB_URL",
  "PRODUCTION_SUPABASE_URL",
  "PRODUCTION_PROJECT_REF",
  "SYNTHETIC_BASE_URL",
  "ALERT_WEBHOOK_URL",
]);

/**
 * Nombres de los jobs de release.yml. Sus check-runs están en el mismo commit
 * mientras corre la release, así que se excluyen de la evaluación del gate.
 */
export const RELEASE_JOB_NAMES = Object.freeze([
  "Release gate",
  "Migrations (production)",
  "Deploy staged",
  "Smoke staged",
  "Discard staged",
  "Promote production",
  "Notify release failure",
]);

/**
 * @typedef {{ id: number, name: string, status: string, conclusion: string | null }} CheckRun
 * @typedef {{ totalCount: number, checkRuns: CheckRun[] }} CheckRunsPage
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * SHA de commit completo (40 hex en minúsculas).
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

/**
 * Secretos requeridos ausentes o vacíos. Devuelve solo los nombres.
 * @param {Record<string, string | undefined>} env
 * @param {readonly string[]} [required]
 * @returns {string[]}
 */
export function findMissingSecrets(env, required = REQUIRED_SECRETS) {
  return required.filter((name) => !isNonEmptyString(env[name]));
}

/**
 * Normaliza la respuesta de GET /repos/{repo}/commits/{sha}/check-runs.
 * Lanza error si la forma no es la esperada (el gate falla en vez de asumir).
 * @param {unknown} data
 * @returns {CheckRunsPage}
 */
export function parseCheckRunsResponse(data) {
  if (typeof data !== "object" || data === null) {
    throw new Error("respuesta de check-runs no es un objeto");
  }
  const record = /** @type {Record<string, unknown>} */ (data);
  const totalCount = record.total_count;
  const rawRuns = record.check_runs;
  if (typeof totalCount !== "number" || !Array.isArray(rawRuns)) {
    throw new Error("respuesta de check-runs sin total_count o check_runs");
  }
  /** @type {CheckRun[]} */
  const checkRuns = rawRuns.map((raw) => {
    const run = /** @type {Record<string, unknown>} */ (typeof raw === "object" && raw !== null ? raw : {});
    if (typeof run.id !== "number" || typeof run.name !== "string" || typeof run.status !== "string") {
      throw new Error("check-run con campos id/name/status no válidos");
    }
    const conclusion = typeof run.conclusion === "string" ? run.conclusion : null;
    return { id: run.id, name: run.name, status: run.status, conclusion };
  });
  return { totalCount, checkRuns };
}

/**
 * Evalúa los check-runs del commit. Pasa solo si hay al menos un check de CI
 * y la última ejecución de cada nombre está completed + success.
 * @param {CheckRunsPage} page
 * @param {readonly string[]} [excludedNames]
 * @returns {{ ok: boolean, failures: string[], evaluated: number }}
 */
export function evaluateCheckRuns(page, excludedNames = RELEASE_JOB_NAMES) {
  /** @type {string[]} */
  const failures = [];
  if (page.totalCount > page.checkRuns.length) {
    failures.push(
      `la API devolvió ${page.checkRuns.length} de ${page.totalCount} check-runs (paginación incompleta)`
    );
  }

  /** @type {Map<string, CheckRun>} */
  const latest = new Map();
  for (const run of page.checkRuns) {
    if (excludedNames.includes(run.name)) continue;
    const current = latest.get(run.name);
    if (!current || run.id > current.id) latest.set(run.name, run);
  }

  if (latest.size === 0) {
    failures.push("no hay check-runs de CI para el commit");
  }
  for (const run of latest.values()) {
    if (run.status !== "completed") {
      failures.push(`"${run.name}" sigue en estado ${run.status}`);
    } else if (run.conclusion !== "success") {
      failures.push(`"${run.name}" terminó con conclusión ${run.conclusion ?? "null"} (se exige success)`);
    }
  }

  return { ok: failures.length === 0, failures, evaluated: latest.size };
}
