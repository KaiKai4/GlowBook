// Smoke de release: reutiliza el check sintético (scripts/quality/synthetic-check.mjs)
// contra la URL staged o la de producción. Si existe VERCEL_AUTOMATION_BYPASS_SECRET,
// añade la cabecera de bypass de la protección de Vercel. El valor nunca se imprime.
// Uso: node scripts/release/smoke.mjs --url=<https://...> [--label=staged]
// Sin --url usa SYNTHETIC_BASE_URL (dominio público de producción).

import { pathToFileURL } from "node:url";
import { resolveCheckUrl, runCheck } from "../quality/synthetic-check.mjs";
import { getArgValue } from "./args.mjs";

export const BYPASS_HEADER = "x-vercel-protection-bypass";

/**
 * Envuelve fetch para añadir la cabecera de bypass cuando hay secreto.
 * Sin secreto devuelve el mismo fetch.
 * @param {typeof fetch} baseFetch
 * @param {string | undefined} secret
 * @returns {typeof fetch}
 */
export function withBypassHeader(baseFetch, secret) {
  const value = (secret ?? "").trim();
  if (value === "") return baseFetch;
  /** @type {typeof fetch} */
  const wrapped = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(BYPASS_HEADER, value);
    return baseFetch(input, { ...init, headers });
  };
  return wrapped;
}

/** @returns {Promise<void>} */
async function main() {
  const args = process.argv.slice(2);
  const label = getArgValue(args, "label") ?? "produccion";
  const rawUrl = getArgValue(args, "url") ?? process.env.SYNTHETIC_BASE_URL;

  let url;
  try {
    url = resolveCheckUrl(rawUrl ?? undefined);
  } catch (error) {
    console.error(`[smoke:${label}] FALLO: ${error instanceof Error ? error.message : "URL no válida"}`);
    process.exit(1);
  }

  const fetchImpl = withBypassHeader(fetch, process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  const result = await runCheck(url, fetchImpl);
  console.log(`[smoke:${label}] status=${result.status ?? "n/a"} tiempo=${result.elapsedMs} ms`);

  if (!result.ok) {
    for (const failure of result.failures) console.error(`[smoke:${label}] FALLO: ${failure}`);
    process.exit(1);
  }
  console.log(`[smoke:${label}] OK`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
