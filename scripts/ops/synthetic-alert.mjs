// Lógica pura de alertas del check sintético (sin I/O; testeable con node:test).
// Decide si hay que alertar y qué hacer con el issue, y construye un payload
// sin secretos: ni URL base, ni valores de cabeceras, ni tokens.

export const ISSUE_LABEL = "synthetic-failure";
const SYNTHETIC_TARGETS = ["production", "staging"];

const MAX_FAILURES = 20;
const MAX_FAILURE_LENGTH = 300;

/**
 * @typedef {"production" | "staging"} SyntheticTarget
 * @typedef {{ ok: boolean, failures: string[], status: number | null, elapsedMs: number | null }} SyntheticResult
 * @typedef {{
 *   event: "glowbook.synthetic_failure",
 *   target: SyntheticTarget,
 *   checkPath: string,
 *   status: number | null,
 *   elapsedMs: number | null,
 *   failures: string[],
 *   runUrl: string,
 *   commit: string,
 *   occurredAt: string,
 * }} AlertPayload
 * @typedef {"none" | "open" | "comment" | "close"} IssueAction
 * @typedef {{ alert: boolean, issue: IssueAction }} AlertDecision
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Valida el objetivo del check.
 * @param {unknown} value
 * @returns {SyntheticTarget}
 */
export function parseSyntheticTarget(value) {
  if (value === "production" || value === "staging") {
    return value;
  }
  throw new Error(`SYNTHETIC_TARGET debe ser ${SYNTHETIC_TARGETS.join(" o ")}.`);
}

/**
 * Valida el JSON que escribe synthetic-check.mjs.
 * @param {unknown} value
 * @returns {SyntheticResult}
 */
export function parseSyntheticResult(value) {
  if (!isRecord(value)) {
    throw new Error("El resultado del check no es un objeto JSON.");
  }
  const { ok, failures, status, elapsedMs } = value;
  if (typeof ok !== "boolean") {
    throw new Error("El resultado del check no tiene el campo ok booleano.");
  }
  if (!Array.isArray(failures)) {
    throw new Error("El resultado del check no tiene la lista failures.");
  }
  /** @type {string[]} */
  const messages = [];
  for (const item of failures) {
    if (typeof item !== "string") {
      throw new Error("La lista failures contiene valores que no son texto.");
    }
    messages.push(item);
  }
  if (status !== null && typeof status !== "number") {
    throw new Error("El campo status no es numerico ni null.");
  }
  if (elapsedMs !== null && typeof elapsedMs !== "number") {
    throw new Error("El campo elapsedMs no es numerico ni null.");
  }
  if (ok !== (messages.length === 0)) {
    throw new Error("El campo ok no coincide con la lista de fallos.");
  }
  return { ok, failures: messages, status, elapsedMs };
}

/**
 * Resultado que se usa cuando el check no dejó archivo (crash, timeout del job).
 * @returns {SyntheticResult}
 */
export function missingResult() {
  return {
    ok: false,
    failures: ["no se genero resultado del check sintetico"],
    status: null,
    elapsedMs: null,
  };
}

/**
 * Quita URLs y limita la longitud de un texto de fallo.
 * @param {string} text
 * @returns {string}
 */
function sanitizeFailure(text) {
  return text
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FAILURE_LENGTH);
}

/**
 * Decide la acción de alerta e issue según el resultado y el issue abierto.
 * @param {{ result: SyntheticResult, openIssueNumber: number | null }} input
 * @returns {AlertDecision}
 */
export function decideSyntheticAction({ result, openIssueNumber }) {
  if (result.ok) {
    return { alert: false, issue: openIssueNumber === null ? "none" : "close" };
  }
  return { alert: true, issue: openIssueNumber === null ? "open" : "comment" };
}

/**
 * Construye el payload del webhook. No incluye URL base, cabeceras ni tokens.
 * @param {{ target: SyntheticTarget, result: SyntheticResult, runUrl: string, commit: string, occurredAt: string }} input
 * @returns {AlertPayload}
 */
export function buildAlertPayload({ target, result, runUrl, commit, occurredAt }) {
  const shortCommit = /^[0-9a-f]{7,40}$/i.test(commit) ? commit.slice(0, 7) : "desconocido";
  return {
    event: "glowbook.synthetic_failure",
    target,
    checkPath: "/login",
    status: result.status,
    elapsedMs: result.elapsedMs,
    failures: result.failures.slice(0, MAX_FAILURES).map(sanitizeFailure),
    runUrl: /^https:\/\/\S+$/.test(runUrl) ? runUrl : "desconocida",
    commit: shortCommit,
    occurredAt,
  };
}

/**
 * @param {SyntheticTarget} target
 * @returns {string}
 */
export function buildIssueTitle(target) {
  return `[synthetic][${target}] check de disponibilidad fallando`;
}

/**
 * @param {string} title
 * @param {SyntheticTarget} target
 * @returns {boolean}
 */
export function isSyntheticIssueTitle(title, target) {
  return title.startsWith(`[synthetic][${target}]`);
}

/**
 * @param {AlertPayload} payload
 * @returns {string}
 */
export function buildIssueBody(payload) {
  const lines = [
    `Check sintetico \`${payload.checkPath}\` fallando en **${payload.target}**.`,
    "",
    `- Estado HTTP: ${payload.status ?? "sin respuesta"}`,
    `- Tiempo: ${payload.elapsedMs ?? "n/a"} ms`,
    `- Commit desplegado en el job: ${payload.commit}`,
    `- Ejecucion: ${payload.runUrl}`,
    `- Hora: ${payload.occurredAt}`,
    "",
    "Fallos:",
    ...payload.failures.map((failure) => `- ${failure}`),
    "",
    "Respuesta: ver docs/runbooks/synthetic-checks.md. Usar el x-request-id de la respuesta para triage en logs.",
  ];
  return lines.join("\n");
}

/**
 * @param {AlertPayload} payload
 * @returns {string}
 */
export function buildFailureComment(payload) {
  return `Sigue fallando (${payload.occurredAt}). Estado: ${payload.status ?? "sin respuesta"}. Fallos: ${payload.failures.join("; ") || "ninguno"}. Ejecucion: ${payload.runUrl}`;
}

/**
 * @param {string} occurredAt
 * @param {string} runUrl
 * @returns {string}
 */
export function buildRecoveryComment(occurredAt, runUrl) {
  return `Check sintetico recuperado el ${occurredAt}. Se cierra el issue. Ejecucion: ${runUrl}`;
}
