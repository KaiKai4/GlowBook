// Alerta de release fallida: construye un payload sin secretos y lo envía a ALERT_WEBHOOK_URL.
// Uso (CI, if: failure()): node scripts/release/alert.mjs --stage=promote --sha=<sha> --url=<url> --run-url=<url> [--rollback=true]
// El payload no incluye tokens, URL de BD ni la URL del webhook.

import { pathToFileURL } from "node:url";
import { isValidSha } from "./gate-logic.mjs";
import { getArgValue } from "./args.mjs";

export const RELEASE_STAGES = Object.freeze([
  "gate",
  "migrations",
  "deploy-staged",
  "smoke-staged",
  "promote",
  "smoke-production",
]);

/**
 * Devuelve solo origen y ruta de una URL https (sin query ni hash), o null.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function sanitizeHttpsUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

/**
 * @typedef {{
 *   stage: string,
 *   sha: string,
 *   deploymentUrl?: string | null,
 *   runUrl?: string | null,
 *   rollbackAttempted?: boolean,
 *   occurredAt?: Date
 * }} AlertInput
 */

/**
 * Construye el payload de alerta. Lanza si la etapa o el SHA no son válidos.
 * @param {AlertInput} input
 * @returns {{ event: string, stage: string, sha: string, deploymentUrl: string | null, runUrl: string | null, rollbackAttempted: boolean, occurredAt: string }}
 */
export function buildAlertPayload(input) {
  if (!RELEASE_STAGES.includes(input.stage)) {
    throw new Error(`etapa de release no reconocida: ${input.stage}`);
  }
  if (!isValidSha(input.sha)) {
    throw new Error("SHA no válido para la alerta");
  }
  return {
    event: "glowbook.release.failed",
    stage: input.stage,
    sha: input.sha,
    deploymentUrl: sanitizeHttpsUrl(input.deploymentUrl ?? null),
    runUrl: sanitizeHttpsUrl(input.runUrl ?? null),
    rollbackAttempted: input.rollbackAttempted === true,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
  };
}

/**
 * Envía el payload por POST JSON. No registra la URL del webhook.
 * @param {string} webhookUrl
 * @param {unknown} payload
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ ok: boolean, status: number | null }>}
 */
export async function sendAlert(webhookUrl, payload, fetchImpl = fetch) {
  const target = sanitizeHttpsUrl(webhookUrl);
  if (target === null) throw new Error("ALERT_WEBHOOK_URL debe ser una URL https válida");
  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const webhookUrl = (process.env.ALERT_WEBHOOK_URL ?? "").trim();
  if (webhookUrl === "") {
    console.error("[alert] FALLO: falta ALERT_WEBHOOK_URL. La alerta no puede enviarse.");
    process.exit(1);
  }

  let payload;
  try {
    payload = buildAlertPayload({
      stage: getArgValue(args, "stage") ?? "",
      sha: getArgValue(args, "sha") ?? "",
      deploymentUrl: getArgValue(args, "url"),
      runUrl: getArgValue(args, "run-url"),
      rollbackAttempted: getArgValue(args, "rollback") === "true",
    });
  } catch (error) {
    console.error(`[alert] FALLO: ${error instanceof Error ? error.message : "payload no válido"}`);
    process.exit(1);
  }

  const result = await sendAlert(webhookUrl, payload);
  if (!result.ok) {
    console.error(`[alert] FALLO: el webhook no aceptó la alerta (estado ${result.status ?? "sin respuesta"}).`);
    process.exit(1);
  }
  console.log(`[alert] Alerta enviada para la etapa ${payload.stage}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
