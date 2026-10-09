// Job de alertas del check sintético (lo invoca .github/workflows/synthetic.yml).
// Lee SYNTHETIC_RESULT_FILE, decide con synthetic-alert.mjs y ejecuta:
// - POST JSON al webhook ALERT_WEBHOOK_URL (solo en fallo);
// - gh issue create / comment / close con la etiqueta synthetic-failure.
// Variables: SYNTHETIC_TARGET, SYNTHETIC_RESULT_FILE, RUN_URL, COMMIT_SHA,
// ALERT_WEBHOOK_URL, GH_TOKEN, GH_REPO.
// No imprime la URL del webhook ni el token.

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  ISSUE_LABEL,
  buildAlertPayload,
  buildFailureComment,
  buildIssueBody,
  buildIssueTitle,
  buildRecoveryComment,
  decideSyntheticAction,
  isRecord,
  isSyntheticIssueTitle,
  missingResult,
  parseSyntheticResult,
  parseSyntheticTarget,
} from "./synthetic-alert.mjs";

/**
 * @typedef {import("./synthetic-alert.mjs").SyntheticResult} SyntheticResult
 * @typedef {import("./synthetic-alert.mjs").SyntheticTarget} SyntheticTarget
 * @typedef {import("./synthetic-alert.mjs").AlertPayload} AlertPayload
 */

const execFileAsync = promisify(execFile);
const WEBHOOK_TIMEOUT_MS = 10000;

/**
 * Ejecuta gh con argumentos separados (sin shell).
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function gh(args) {
  const { stdout } = await execFileAsync("gh", args, { encoding: "utf8" });
  return stdout;
}

/**
 * Lee el resultado del check; si no existe, registra un fallo explícito.
 * @param {string | undefined} path
 * @returns {Promise<SyntheticResult>}
 */
export async function loadResult(path) {
  if (!path || path.trim() === "") {
    throw new Error("Falta SYNTHETIC_RESULT_FILE.");
  }
  let raw;
  try {
    raw = await readFile(path.trim(), "utf8");
  } catch {
    return missingResult();
  }
  /** @type {unknown} */
  const parsed = JSON.parse(raw);
  return parseSyntheticResult(parsed);
}

/**
 * Devuelve los números de issues abiertos con la etiqueta y título del target.
 * @param {SyntheticTarget} target
 * @returns {Promise<number[]>}
 */
export async function findOpenSyntheticIssues(target) {
  const raw = await gh([
    "issue", "list",
    "--label", ISSUE_LABEL,
    "--state", "open",
    "--limit", "100",
    "--json", "number,title",
  ]);
  /** @type {unknown} */
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("gh issue list no devolvio una lista.");
  }
  /** @type {number[]} */
  const numbers = [];
  for (const item of parsed) {
    if (isRecord(item) && typeof item.number === "number" && typeof item.title === "string"
      && isSyntheticIssueTitle(item.title, target)) {
      numbers.push(item.number);
    }
  }
  return numbers;
}

/**
 * Envía el payload al webhook. Errores sin exponer la URL.
 * @param {string} url
 * @param {AlertPayload} payload
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<void>}
 */
export async function postWebhook(url, payload, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`el webhook de alertas respondio HTTP ${response.status}`);
  }
}

/**
 * Ejecuta la acción sobre el issue según la decisión.
 * @param {ReturnType<typeof decideSyntheticAction>["issue"]} action
 * @param {{ target: SyntheticTarget, openIssueNumber: number | null, payload: AlertPayload }} input
 * @returns {Promise<string>} descripción breve de lo realizado
 */
async function applyIssueAction(action, { target, openIssueNumber, payload }) {
  if (action === "none") {
    return "sin issue (check correcto y sin incidencia abierta)";
  }
  if (action === "open") {
    await gh(["label", "create", ISSUE_LABEL, "--color", "B60205",
      "--description", "Fallo del check sintetico de disponibilidad", "--force"]);
    await gh(["issue", "create", "--title", buildIssueTitle(target),
      "--body", buildIssueBody(payload), "--label", ISSUE_LABEL]);
    return "issue creado";
  }
  if (openIssueNumber === null) {
    throw new Error("Falta el numero del issue abierto.");
  }
  if (action === "comment") {
    await gh(["issue", "comment", String(openIssueNumber), "--body", buildFailureComment(payload)]);
    return `comentario en el issue #${openIssueNumber}`;
  }
  await gh(["issue", "comment", String(openIssueNumber), "--body",
    buildRecoveryComment(payload.occurredAt, payload.runUrl)]);
  await gh(["issue", "close", String(openIssueNumber)]);
  return `issue #${openIssueNumber} cerrado por recuperacion`;
}

async function main() {
  const target = parseSyntheticTarget(process.env.SYNTHETIC_TARGET);
  const result = await loadResult(process.env.SYNTHETIC_RESULT_FILE);
  const payload = buildAlertPayload({
    target,
    result,
    runUrl: process.env.RUN_URL ?? "desconocida",
    commit: process.env.COMMIT_SHA ?? "",
    occurredAt: new Date().toISOString(),
  });

  const openNumbers = await findOpenSyntheticIssues(target);
  const openIssueNumber = openNumbers.length > 0 ? openNumbers[0] : null;
  const decision = decideSyntheticAction({ result, openIssueNumber });

  /** @type {string[]} */
  const errors = [];
  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim() ?? "";

  if (decision.alert) {
    if (webhookUrl === "") {
      errors.push("ALERT_WEBHOOK_URL no esta configurado; la alerta no pudo enviarse.");
    } else {
      try {
        await postWebhook(webhookUrl, payload);
        console.log("[OK] alerta enviada al webhook");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  try {
    const summary = await applyIssueAction(decision.issue, { target, openIssueNumber, payload });
    console.log(`[OK] ${summary}`);
  } catch (error) {
    errors.push(`gestion del issue fallo: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (errors.length > 0) {
    for (const message of errors) {
      console.error(`[FAIL] ${message}`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
