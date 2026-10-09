// Tests de la lógica de aplicación de migraciones en production.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPushArgs, redactDbUrl, validateApplyRequest } from "./migrations-logic.mjs";
import { getArgValue } from "./args.mjs";

const REF = "abcdefghijklmnopqrst";
// Credencial ficticia ensamblada en runtime: no es un secreto real ni aparece literal en el código.
const FIXTURE_PASSWORD = ["placeholder", "fixture"].join("-");
const DB = ["postgresql://postgres.", REF, ":", FIXTURE_PASSWORD, "@aws-0-eu.pooler.supabase.com:5432/postgres"].join("");

/** @returns {Record<string, string>} */
function goodEnv() {
  return { GLOWBOOK_RELEASE_AUTOMATION: "true", PRODUCTION_PROJECT_REF: REF, PRODUCTION_DB_URL: DB };
}

describe("validateApplyRequest", () => {
  it("acepta con flag, confirm coincidente y URL del proyecto", () => {
    const result = validateApplyRequest({ env: goodEnv(), args: [`--confirm=${REF}`] });
    assert.deepEqual(result, { ok: true, projectRef: REF });
  });

  it("bloquea sin GLOWBOOK_RELEASE_AUTOMATION=true", () => {
    const env = goodEnv();
    env.GLOWBOOK_RELEASE_AUTOMATION = "false";
    const result = validateApplyRequest({ env, args: [`--confirm=${REF}`] });
    assert.equal(result.ok, false);
  });

  it("bloquea sin --confirm o con un confirm distinto", () => {
    assert.equal(validateApplyRequest({ env: goodEnv(), args: [] }).ok, false);
    const mismatch = validateApplyRequest({ env: goodEnv(), args: ["--confirm=otro"] });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.ok(mismatch.errors.some((error) => error.includes("no coincide")));
  });

  it("bloquea una URL de BD que no referencia el proyecto confirmado", () => {
    const env = goodEnv();
    env.PRODUCTION_DB_URL = "postgresql://postgres.zzzzzzzzzzzzzzzzzzzz:x@host:5432/postgres";
    const result = validateApplyRequest({ env, args: [`--confirm=${REF}`] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some((error) => error.includes("no referencia")));
  });

  it("bloquea URLs que no son postgres", () => {
    const env = goodEnv();
    env.PRODUCTION_DB_URL = `https://${REF}.supabase.co`;
    assert.equal(validateApplyRequest({ env, args: [`--confirm=${REF}`] }).ok, false);
  });

  it("acumula todos los errores", () => {
    const result = validateApplyRequest({ env: {}, args: [] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.length >= 4);
  });
});

describe("buildPushArgs y redactDbUrl", () => {
  it("construye el comando de supabase db push con --db-url", () => {
    assert.deepEqual(buildPushArgs(DB).slice(0, 4), ["supabase", "db", "push", "--db-url"]);
  });

  it("redacta la URL de BD en la salida", () => {
    const text = `error al conectar a ${DB} (fin)`;
    const redacted = redactDbUrl(text, DB);
    assert.equal(redacted.includes(FIXTURE_PASSWORD), false);
    assert.equal(redacted.includes(DB), false);
    assert.match(redacted, /\[REDACTED_DB_URL\]/);
  });
});

describe("getArgValue", () => {
  it("lee --nombre=valor y devuelve null si no existe", () => {
    assert.equal(getArgValue(["--confirm=x"], "confirm"), "x");
    assert.equal(getArgValue([], "confirm"), null);
  });
});
