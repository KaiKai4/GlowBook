// Lógica pura para aplicar migraciones en production (sin I/O).
// Doble guarda: GLOWBOOK_RELEASE_AUTOMATION=true y --confirm=<PRODUCTION_PROJECT_REF>.
// La URL de BD debe referenciar exactamente ese proyecto.

import { getArgValue } from "./args.mjs";

const RELEASE_AUTOMATION_FLAG = "GLOWBOOK_RELEASE_AUTOMATION";

/**
 * @param {string} value
 * @returns {boolean}
 */
function isPostgresUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

/**
 * Valida si se puede aplicar migraciones a production.
 * @param {{ env: Record<string, string | undefined>, args: readonly string[] }} input
 * @returns {{ ok: true, projectRef: string } | { ok: false, errors: string[] }}
 */
export function validateApplyRequest({ env, args }) {
  /** @type {string[]} */
  const errors = [];

  if (env[RELEASE_AUTOMATION_FLAG] !== "true") {
    errors.push(`${RELEASE_AUTOMATION_FLAG} debe ser "true": solo la automatización de release aplica migraciones`);
  }

  const projectRef = (env.PRODUCTION_PROJECT_REF ?? "").trim();
  if (projectRef === "") errors.push("falta PRODUCTION_PROJECT_REF");

  const confirm = getArgValue(args, "confirm");
  if (confirm === null || confirm === "") {
    errors.push("falta --confirm=<PRODUCTION_PROJECT_REF>");
  } else if (projectRef !== "" && confirm !== projectRef) {
    errors.push("--confirm no coincide con PRODUCTION_PROJECT_REF");
  }

  const dbUrl = (env.PRODUCTION_DB_URL ?? "").trim();
  if (dbUrl === "") {
    errors.push("falta PRODUCTION_DB_URL");
  } else if (!isPostgresUrl(dbUrl)) {
    errors.push("PRODUCTION_DB_URL debe ser una URL postgres:// o postgresql://");
  } else if (projectRef !== "" && !dbUrl.includes(projectRef)) {
    errors.push("PRODUCTION_DB_URL no referencia el proyecto confirmado");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, projectRef };
}

/**
 * Argumentos de `supabase db push` contra la URL indicada (CLI del paquete npm).
 * @param {string} dbUrl
 * @returns {string[]}
 */
export function buildPushArgs(dbUrl) {
  return ["supabase", "db", "push", "--db-url", dbUrl, "--yes"];
}

/**
 * Sustituye la URL de BD en un texto para que no aparezca en logs.
 * @param {string} text
 * @param {string} dbUrl
 * @returns {string}
 */
export function redactDbUrl(text, dbUrl) {
  if (dbUrl === "") return text;
  return text.split(dbUrl).join("[REDACTED_DB_URL]");
}
