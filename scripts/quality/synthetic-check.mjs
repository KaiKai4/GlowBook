// Check sintético de disponibilidad: GET <base>/login.
// Comprueba estado 200 (sin seguir redirecciones), cabeceras de seguridad
// (incluida Strict-Transport-Security), x-request-id con formato UUID y
// tiempo de respuesta < 3000 ms.
// Uso (CI synthetic.yml y nightly): SYNTHETIC_BASE_URL=https://... node scripts/quality/synthetic-check.mjs
// Opcional: SYNTHETIC_RESULT_FILE=<ruta.json> guarda el resultado (sin URL base) para el job de alertas.
// No imprime la URL base ni valores de cabeceras: solo nombres y resultados.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @typedef {{ ok: boolean, failures: string[], status: number | null, elapsedMs: number }} CheckResult
 */

const CHECK_PATH = "/login";
const MAX_RESPONSE_MS = 3000;
const REQUEST_TIMEOUT_MS = 10000;
const REQUIRED_HEADERS = [
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "content-security-policy",
  "strict-transport-security",
];
const REQUEST_ID_HEADER = "x-request-id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida la URL base y devuelve la URL del check.
 * @param {string | undefined} raw
 * @returns {URL}
 */
export function resolveCheckUrl(raw) {
  if (!raw || raw.trim() === "") {
    throw new Error("Falta SYNTHETIC_BASE_URL. El check sintetico no puede ejecutarse.");
  }
  let base;
  try {
    base = new URL(raw.trim());
  } catch {
    throw new Error("SYNTHETIC_BASE_URL no es una URL valida.");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("SYNTHETIC_BASE_URL debe usar http o https.");
  }
  const url = new URL(CHECK_PATH, base);
  url.search = "";
  url.hash = "";
  return url;
}

/**
 * Evalúa cabeceras de seguridad y x-request-id. Función pura, sin red.
 * @param {Headers} headers
 * @returns {string[]} fallos encontrados (vacío si todo es correcto)
 */
export function evaluateHeaders(headers) {
  /** @type {string[]} */
  const failures = [];
  for (const name of REQUIRED_HEADERS) {
    const value = headers.get(name);
    if (value === null) {
      failures.push(`falta la cabecera de seguridad ${name}`);
    } else if (value.trim() === "") {
      failures.push(`la cabecera de seguridad ${name} esta vacia`);
    }
  }
  const requestId = headers.get(REQUEST_ID_HEADER);
  if (requestId === null) {
    failures.push(`falta la cabecera ${REQUEST_ID_HEADER}`);
  } else if (!UUID_PATTERN.test(requestId.trim())) {
    failures.push(`la cabecera ${REQUEST_ID_HEADER} no tiene formato UUID`);
  }
  return failures;
}

/**
 * Ejecuta el check contra la URL indicada.
 * @param {URL} url
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<CheckResult>}
 */
export async function runCheck(url, fetchImpl = fetch) {
  /** @type {string[]} */
  const failures = [];
  const startedAt = performance.now();
  let status = null;
  let headers = new Headers();

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    status = response.status;
    headers = response.headers;
    // Consumir el cuerpo para medir el tiempo completo de la respuesta.
    await response.arrayBuffer();
  } catch (error) {
    const reason = error instanceof Error ? error.name : "error desconocido";
    failures.push(`no se obtuvo respuesta (${reason})`);
  }

  const elapsedMs = Math.round(performance.now() - startedAt);

  if (status !== null && status !== 200) {
    failures.push(`estado HTTP ${status} (se esperaba 200)`);
  }

  if (status !== null) {
    failures.push(...evaluateHeaders(headers));
  }

  if (elapsedMs >= MAX_RESPONSE_MS) {
    failures.push(`tiempo de respuesta ${elapsedMs} ms (maximo ${MAX_RESPONSE_MS} ms)`);
  }

  return { ok: failures.length === 0, failures, status, elapsedMs };
}

/**
 * Guarda el resultado en disco (sin URL base ni cabeceras).
 * @param {string} path
 * @param {CheckResult} result
 * @returns {Promise<void>}
 */
export async function writeResultFile(path, result) {
  await mkdir(dirname(path), { recursive: true });
  const payload = { ...result, checkedAt: new Date().toISOString() };
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  let url;
  try {
    url = resolveCheckUrl(process.env.SYNTHETIC_BASE_URL);
  } catch (error) {
    console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const result = await runCheck(url);
  console.log(`GET ${CHECK_PATH} -> status=${result.status ?? "n/a"} tiempo=${result.elapsedMs} ms`);

  const resultFile = process.env.SYNTHETIC_RESULT_FILE?.trim();
  if (resultFile) {
    await writeResultFile(resultFile, result);
  }

  if (!result.ok) {
    for (const failure of result.failures) {
      console.error(`[FAIL] ${failure}`);
    }
    process.exit(1);
  }

  console.log("[OK] check sintetico superado");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
