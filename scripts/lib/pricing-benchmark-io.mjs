// E/S del benchmark de precios v2: inserción por lotes con contabilidad por cohorte y
// creación (o reutilización) de usuarios de Auth. Recibe el cliente admin como parámetro.
import { chunk } from "../seed-common.mjs";

/**
 * @typedef {import("@supabase/supabase-js").SupabaseClient} SupabaseClient
 * @typedef {import("../types/seeds.d.cts").DbRow} DbRow
 * @typedef {import("../types/seeds.d.cts").SeedSummary} SeedSummary
 */

/**
 * Acumula filas y bytes JSON por tabla y cohorte en el resumen.
 * @param {SeedSummary} summary
 * @param {string} cohortKey
 * @param {string} table
 * @param {unknown[]} rows
 * @returns {void}
 */
function addPayload(summary, cohortKey, table, rows) {
  summary.totalRows += rows.length;
  summary.cohorts[cohortKey].tables[table] ??= { rows: 0, jsonBytes: 0 };
  summary.cohorts[cohortKey].tables[table].rows += rows.length;
  summary.cohorts[cohortKey].tables[table].jsonBytes += Buffer.byteLength(JSON.stringify(rows), "utf8");
}

/**
 * Crea el insertador de un salón: contabiliza cada tabla e inserta en lotes de `batchSize`.
 * Con `select` devuelve las filas insertadas (con esas columnas).
 * @param {{ admin: SupabaseClient, summary: SeedSummary, cohortKey: string, batchSize: number }} options
 * @returns {(table: string, rows: unknown[], select?: string) => Promise<DbRow[]>}
 */
export function createInserter({ admin, summary, cohortKey, batchSize }) {
  return async function insert(table, rows, select = undefined) {
    if (rows.length === 0) return [];
    addPayload(summary, cohortKey, table, rows);
    /** @type {DbRow[]} */
    const inserted = [];
    for (const group of chunk(rows, batchSize)) {
      const insertQuery = admin.from(table).insert(group);
      const query = select ? insertQuery.select(select) : insertQuery;
      const { data, error } = await query;
      if (error) throw new Error(`${table}: ${error.message}`);
      if (data) inserted.push(.../** @type {DbRow[]} */ (/** @type {unknown} */ (data)));
    }
    return inserted;
  };
}

/**
 * Busca el id de un usuario de Auth por correo recorriendo hasta 20 páginas de 1000.
 * @param {SupabaseClient} admin
 * @param {string} email
 * @returns {Promise<string | null>}
 */
async function findAuthUserIdByEmail(admin, email) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

/**
 * Crea un usuario de Auth del benchmark. Si ya existe lo reutiliza; si falla y `allowSynthetic`
 * está activo devuelve null (usuario sintético sin cuenta); en otro caso propaga el error.
 * @param {{ admin: SupabaseClient, email: string, fullName: string, password: string, allowSynthetic: boolean }} options
 * @returns {Promise<string | null>}
 */
export async function createAuthUser({ admin, email, fullName, password, allowSynthetic }) {
  /** @type {Awaited<ReturnType<typeof admin.auth.admin.createUser>>} */
  let result;
  try {
    result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, seed_kind: "pricing-benchmark-v2" },
    });
  } catch (error) {
    const existingUserId = await findAuthUserIdByEmail(admin, email);
    if (existingUserId) return existingUserId;
    if (allowSynthetic) return null;
    throw error;
  }

  if (result.error || !result.data.user) {
    const existingUserId = await findAuthUserIdByEmail(admin, email);
    if (existingUserId) return existingUserId;
    if (allowSynthetic) return null;
    throw result.error ?? new Error(`Auth user was not created for ${email}.`);
  }
  return result.data.user.id;
}
