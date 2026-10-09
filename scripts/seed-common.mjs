import { normalizeUrl } from "./lib/url.mjs";
// Utilidades compartidas por los scripts de seed de staging (smoke, scale y pricing).
// Son funciones puras de E/S o de lote; cada script conserva sus constantes y su propio "fail".
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** @typedef {import("./types/seeds.d.cts").DbRow} DbRow */

const BATCH_SIZE = 100;

export function loadEnvFileIfPresent() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=");
  }
}

/**
 * @template T
 * @param {T[]} rows
 * @param {number} [size]
 * @returns {T[][]}
 */
export function chunk(rows, size = BATCH_SIZE) {
  /** @type {T[][]} */
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} admin @param {string} table @param {unknown[]} rows @param {string} [select] @returns {Promise<DbRow[]>} */
export async function insertRows(admin, table, rows, select = undefined) {
  if (rows.length === 0) return [];

  /** @type {DbRow[]} */
  const inserted = [];
  for (const group of chunk(rows)) {
    const insertQuery = admin.from(table).insert(group);
    const query = select ? insertQuery.select(select) : insertQuery;
    const { data, error } = await query;
    if (error) throw error;
    if (data) inserted.push(.../** @type {DbRow[]} */ (/** @type {unknown} */ (data)));
  }

  return inserted;
}

/** @param {string} batchId @param {number} salonIndex @param {string} entity */
export function emailFor(batchId, entity, salonIndex, itemIndex = 0) {
  return `glowbook.${batchId}.${entity}.${salonIndex}.${itemIndex}@example.com`;
}

/** @param {number} hour @param {number} offsetDays */
export function dateAt(offsetDays, hour, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

/** @param {Date} date */
export function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

/** @param {Date} date @param {number} minutes */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Entorno declarado de la app (GLOWBOOK_ENV, APP_ENV o VERCEL_ENV) en minúsculas. */
export function readAppEnv() {
  return (process.env.GLOWBOOK_ENV ?? process.env.APP_ENV ?? process.env.VERCEL_ENV ?? "").toLowerCase();
}

/**
 * Guardas de entorno de los seeds de staging: entorno staging (o local explícito) y nunca producción.
 * Cada script aporta su propio `fail` (mensaje con su etiqueta) y su bandera de local.
 * @param {{ appEnv: string, allowLocal: boolean, allowLocalFlag: string, fail: (message: string) => never }} options
 * @returns {void}
 */
export function assertSeedEnvironment({ appEnv, allowLocal, allowLocalFlag, fail }) {
  if (appEnv !== "staging" && !allowLocal) {
    fail(`Set GLOWBOOK_ENV=staging, or ${allowLocalFlag}=true for local-only experiments.`);
  }
  if (appEnv === "production") {
    fail("Refusing to seed a production environment.");
  }
}

/**
 * Rechaza un destino igual a PRODUCTION_SUPABASE_URL (comparación normalizada).
 * @param {{ supabaseUrl: string, productionSupabaseUrl: string | undefined, fail: (message: string) => never }} options
 * @returns {void}
 */
export function assertNotProductionUrl({ supabaseUrl, productionSupabaseUrl, fail }) {
  if (productionSupabaseUrl && normalizeUrl(supabaseUrl) === normalizeUrl(productionSupabaseUrl)) {
    fail("Refusing to seed PRODUCTION_SUPABASE_URL.");
  }
}

/**
 * Devuelve la primera fila que cumple el predicado; falla si la semilla es inconsistente.
 * @param {DbRow[]} rows
 * @param {(row: DbRow) => boolean} predicate
 * @param {string} label
 * @returns {DbRow}
 */
export function requireRow(rows, predicate, label) {
  const row = rows.find(predicate);
  if (!row) throw new Error(`No se encontró ${label} en la semilla.`);
  return row;
}
