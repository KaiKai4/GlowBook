// Pruebas de la E/S del benchmark (node:test) con un cliente admin simulado: sin red ni base de datos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthUser, createInserter } from "./pricing-benchmark-io.mjs";

/**
 * @typedef {import("@supabase/supabase-js").SupabaseClient} SupabaseClient
 * @typedef {import("../types/seeds.d.cts").SeedSummary} SeedSummary
 */

/**
 * Resultado de una consulta de inserción: awaitable y con `select` que devuelve la misma promesa.
 * @param {{ data: unknown, error: { message: string } | null }} result
 */
function insertQuery(result) {
  const promise = Promise.resolve(result);
  return Object.assign(promise, { select: () => promise });
}

/** @returns {SeedSummary} */
function emptySummary() {
  return {
    batchId: "pricing-benchmark-v2-test",
    password: "x",
    accounts: [],
    totalRows: 0,
    cohorts: { A: { label: "A", salons: 0, authUsers: 0, tables: {} } },
  };
}

/**
 * Cliente simulado que registra cada lote insertado y devuelve filas con id.
 * @param {{ failTable?: string }} [options]
 */
function fakeInsertClient(options = {}) {
  /** @type {{ table: string, size: number }[]} */
  const calls = [];
  const client = {
    from(/** @type {string} */ table) {
      return {
        insert(/** @type {Record<string, unknown>[]} */ group) {
          calls.push({ table, size: group.length });
          if (table === options.failTable) return insertQuery({ data: null, error: { message: "boom" } });
          const data = group.map((row, index) => ({ ...row, id: `${table}-${calls.length}-${index}` }));
          return insertQuery({ data, error: null });
        },
      };
    },
  };
  return { client: /** @type {SupabaseClient} */ (/** @type {unknown} */ (client)), calls };
}

test("createInserter no hace nada con un lote vacío", async () => {
  const { client, calls } = fakeInsertClient();
  const summary = emptySummary();
  const insert = createInserter({ admin: client, summary, cohortKey: "A", batchSize: 10 });
  assert.deepEqual(await insert("services", []), []);
  assert.equal(calls.length, 0);
  assert.equal(summary.totalRows, 0);
});

test("createInserter parte en lotes del tamaño indicado y devuelve las filas insertadas", async () => {
  const { client, calls } = fakeInsertClient();
  const summary = emptySummary();
  const insert = createInserter({ admin: client, summary, cohortKey: "A", batchSize: 2 });
  const rows = [{ n: 1 }, { n: 2 }, { n: 3 }];
  const inserted = await insert("customers", rows, "id");
  assert.deepEqual(calls.map((call) => call.size), [2, 1]);
  assert.equal(inserted.length, 3);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.cohorts.A.tables.customers.rows, 3);
  assert.ok(summary.cohorts.A.tables.customers.jsonBytes > 0);
});

test("createInserter acumula filas por tabla dentro de la cohorte", async () => {
  const { client } = fakeInsertClient();
  const summary = emptySummary();
  const insert = createInserter({ admin: client, summary, cohortKey: "A", batchSize: 500 });
  await insert("services", [{ a: 1 }]);
  await insert("services", [{ a: 2 }, { a: 3 }]);
  assert.equal(summary.cohorts.A.tables.services.rows, 3);
  assert.equal(summary.totalRows, 3);
});

test("createInserter envuelve el error de Supabase con el nombre de la tabla", async () => {
  const { client } = fakeInsertClient({ failTable: "appointments" });
  const insert = createInserter({ admin: client, summary: emptySummary(), cohortKey: "A", batchSize: 5 });
  await assert.rejects(insert("appointments", [{ a: 1 }]), new Error("appointments: boom"));
});

/**
 * Cliente de Auth simulado.
 * @param {{ createUser: (args: unknown) => Promise<unknown>, users?: { id: string, email: string }[] }} options
 */
function fakeAuthClient({ createUser, users = [] }) {
  const client = {
    auth: {
      admin: {
        createUser,
        listUsers: async (/** @type {{ page: number, perPage: number }} */ { page, perPage }) => ({
          data: { users: page === 1 ? users.slice(0, perPage) : [] },
          error: null,
        }),
      },
    },
  };
  return /** @type {SupabaseClient} */ (/** @type {unknown} */ (client));
}

test("createAuthUser devuelve el id del usuario creado", async () => {
  const admin = fakeAuthClient({
    createUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
  });
  const id = await createAuthUser({ admin, email: "a@example.com", fullName: "A", password: "p", allowSynthetic: false });
  assert.equal(id, "user-1");
});

test("createAuthUser reutiliza el usuario existente si la creación falla", async () => {
  const admin = fakeAuthClient({
    createUser: async () => ({ data: { user: null }, error: { message: "already registered" } }),
    users: [{ id: "existing-9", email: "A@example.com" }],
  });
  const id = await createAuthUser({ admin, email: "a@example.com", fullName: "A", password: "p", allowSynthetic: false });
  assert.equal(id, "existing-9");
});

test("createAuthUser devuelve null en modo sintético cuando no puede crear ni encontrar el usuario", async () => {
  const admin = fakeAuthClient({
    createUser: async () => {
      throw new Error("network");
    },
  });
  const id = await createAuthUser({ admin, email: "b@example.com", fullName: "B", password: "p", allowSynthetic: true });
  assert.equal(id, null);
});

test("createAuthUser propaga el error si no es sintético y no hay usuario", async () => {
  const admin = fakeAuthClient({
    createUser: async () => ({ data: { user: null }, error: { message: "rate limited" } }),
  });
  await assert.rejects(
    createAuthUser({ admin, email: "c@example.com", fullName: "C", password: "p", allowSynthetic: false }),
    (/** @type {{ message: string }} */ error) => error.message === "rate limited"
  );
});
