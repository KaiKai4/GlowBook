// Tests de las reglas de migraciones forward-only (node:test, sin base de datos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeMigration } from "./migration-rules.mjs";

const EXISTING = ["20240101000063"];
const PLAIN = "20240101000070_add_column.sql";
const CONTRACT = "20240101000071_contract_drop_legacy.sql";
const CONTRACT_HEADER = "-- contract-of: 20240101000063\n";

/**
 * @param {string} fileName
 * @param {string} sql
 * @returns {string[]}
 */
function rulesOf(fileName, sql) {
  return analyzeMigration(fileName, sql, EXISTING).violations.map((violation) => violation.rule);
}

test("migracion aditiva con columna nullable e indice es valida", () => {
  const sql = "SET lock_timeout = '5s';\nALTER TABLE public.customers ADD COLUMN nickname text;\nCREATE INDEX customers_nickname_idx ON public.customers (nickname);";
  assert.deepEqual(analyzeMigration(PLAIN, sql, EXISTING), { ok: true, violations: [] });
});

test("RENAME COLUMN y RENAME TO estan prohibidos", () => {
  assert.deepEqual(rulesOf(PLAIN, "ALTER TABLE t RENAME COLUMN a TO b;"), ["rename"]);
  assert.deepEqual(rulesOf(PLAIN, "ALTER TABLE t RENAME TO t2;"), ["rename"]);
});

test("DROP COLUMN sin nombre contract es invalido", () => {
  assert.deepEqual(rulesOf(PLAIN, `${CONTRACT_HEADER}ALTER TABLE t DROP COLUMN a;`), ["drop-column"]);
});

test("DROP COLUMN en migracion contract con cabecera valida es valido", () => {
  assert.deepEqual(rulesOf(CONTRACT, `${CONTRACT_HEADER}ALTER TABLE t DROP COLUMN a;`), []);
});

test("contract sin cabecera contract-of es invalido", () => {
  assert.deepEqual(rulesOf(CONTRACT, "DROP TABLE legacy_table;"), ["drop-table"]);
});

test("contract-of con id inexistente es invalido", () => {
  const sql = "-- contract-of: 20990101000000\nDROP TABLE legacy_table;";
  assert.deepEqual(rulesOf(CONTRACT, sql), ["drop-table"]);
  const [violation] = analyzeMigration(CONTRACT, sql, EXISTING).violations;
  assert.match(violation.message, /no es una migración existente/);
});

test("la cabecera contract-of se valida con la ruta completa y solo en el nombre contract", () => {
  const sql = `${CONTRACT_HEADER}DROP TABLE legacy_table;`;
  assert.deepEqual(rulesOf(`supabase/migrations/${CONTRACT}`, sql), []);
  assert.deepEqual(rulesOf(`supabase/migrations/${PLAIN}`, sql), ["drop-table"]);
});

test("ALTER COLUMN TYPE y SET NOT NULL solo en contract valido", () => {
  const typeChange = "ALTER TABLE t ALTER COLUMN amount TYPE numeric(12,2);";
  const notNull = "ALTER TABLE t ALTER COLUMN name SET NOT NULL;";
  assert.deepEqual(rulesOf(PLAIN, typeChange), ["alter-type"]);
  assert.deepEqual(rulesOf(PLAIN, notNull), ["set-not-null"]);
  assert.deepEqual(rulesOf(CONTRACT, `${CONTRACT_HEADER}${typeChange}`), []);
  assert.deepEqual(rulesOf(CONTRACT, `${CONTRACT_HEADER}${notNull}`), []);
});

test("DROP CONSTRAINT solo en contract valido", () => {
  const drop = "ALTER TABLE t DROP CONSTRAINT t_amount_check;";
  assert.deepEqual(rulesOf(PLAIN, drop), ["drop-constraint"]);
  assert.deepEqual(rulesOf(CONTRACT, drop), ["drop-constraint"]);
  assert.deepEqual(rulesOf(CONTRACT, `${CONTRACT_HEADER}${drop}`), []);
});

test("DROP INDEX esta permitido en cualquier migracion", () => {
  assert.deepEqual(rulesOf(PLAIN, "DROP INDEX IF EXISTS public.customers_nickname_idx;"), []);
});

test("DROP POLICY solo si la misma migracion recrea la politica con el mismo nombre en la misma tabla", () => {
  const drop = "DROP POLICY IF EXISTS customers_select ON public.customers;";
  assert.deepEqual(rulesOf(PLAIN, drop), ["drop-policy"]);

  const recreate = "CREATE POLICY customers_select ON public.customers FOR SELECT USING (true);";
  assert.deepEqual(rulesOf(PLAIN, `${drop}\n${recreate}`), []);
});

test("DROP POLICY no se admite si la politica recreada tiene otro nombre o tabla", () => {
  const drop = "DROP POLICY customers_select ON public.customers;";
  assert.deepEqual(rulesOf(PLAIN, `${drop}\nCREATE POLICY customers_insert ON public.customers FOR INSERT WITH CHECK (true);`), ["drop-policy"]);
  assert.deepEqual(rulesOf(PLAIN, `${drop}\nCREATE POLICY customers_select ON public.services FOR SELECT USING (true);`), ["drop-policy"]);
});

test("DROP POLICY compara nombres entre comillas y sin esquema", () => {
  const drop = 'DROP POLICY "customers_select" ON customers;';
  const recreate = "CREATE POLICY customers_select ON public.customers FOR SELECT USING (true);";
  assert.deepEqual(rulesOf(PLAIN, `${drop}\n${recreate}`), []);
});

test("TRUNCATE siempre esta prohibido, incluso en contract", () => {
  assert.deepEqual(rulesOf(CONTRACT, `${CONTRACT_HEADER}TRUNCATE TABLE sessions;`), ["truncate"]);
});

test("DELETE FROM sin WHERE esta prohibido y con WHERE es valido", () => {
  assert.deepEqual(rulesOf(PLAIN, "DELETE FROM sessions;"), ["delete-without-where"]);
  assert.deepEqual(rulesOf(PLAIN, "DELETE FROM sessions WHERE expired_at < now();"), []);
});

test("DROP FUNCTION solo si la misma migracion recrea la funcion", () => {
  const drop = "DROP FUNCTION IF EXISTS public.calc_total(uuid);";
  assert.deepEqual(rulesOf(PLAIN, drop), ["drop-function"]);
  const recreate = `${drop}\nCREATE OR REPLACE FUNCTION public.calc_total(p_id uuid) RETURNS numeric LANGUAGE sql AS $$ SELECT 1 $$;`;
  assert.deepEqual(rulesOf(PLAIN, recreate), []);
});

test("comentarios no generan violaciones", () => {
  const sql = "-- DELETE FROM sessions;\n/* TRUNCATE TABLE x; */\nALTER TABLE t ADD COLUMN c int;";
  assert.deepEqual(analyzeMigration(PLAIN, sql, EXISTING), { ok: true, violations: [] });
});

test("palabras clave dentro de literales no generan violaciones", () => {
  const sql = "INSERT INTO notes (body) VALUES ('TRUNCATE; DELETE FROM x; -- no es comentario');";
  assert.deepEqual(analyzeMigration(PLAIN, sql, EXISTING), { ok: true, violations: [] });
});

test("un -- dentro de un literal no comenta el resto de la sentencia", () => {
  assert.deepEqual(rulesOf(PLAIN, "INSERT INTO notes (body) VALUES ('a--b'); DELETE FROM sessions;"), ["delete-without-where"]);
});

test("un punto y coma dentro de un literal no separa sentencias", () => {
  assert.deepEqual(rulesOf(PLAIN, "INSERT INTO notes (body) VALUES ('x; DELETE FROM sessions');"), []);
});

test("CREATE INDEX sobre tabla existente exige set lock_timeout", () => {
  const index = "CREATE UNIQUE INDEX reminder_log_key ON public.appointment_reminder_log (salon_id, idempotency_key) WHERE idempotency_key IS NOT NULL;";
  assert.deepEqual(rulesOf(PLAIN, index), ["index-lock-timeout"]);
  assert.deepEqual(rulesOf(PLAIN, `SET lock_timeout = '5s';\n${index}`), []);
  assert.deepEqual(rulesOf(PLAIN, `set local lock_timeout to '3s';\n${index}`), []);
});

test("CREATE INDEX sobre una tabla creada en la misma migracion no exige lock_timeout", () => {
  const sql = "CREATE TABLE public.idempotency_keys (id uuid primary key, created_at timestamptz);\nCREATE INDEX idempotency_keys_created_at_idx ON idempotency_keys (created_at);";
  assert.deepEqual(rulesOf(PLAIN, sql), []);
});

test("los comentarios squawk-ignore en linea estan prohibidos", () => {
  const sql = "SET lock_timeout = '1s';\n-- squawk-ignore ban-drop-function\nALTER TABLE t ADD COLUMN c int;";
  assert.deepEqual(rulesOf(PLAIN, sql), ["squawk-ignore"]);
});
