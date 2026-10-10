// Tests de la lógica de aplicación de migraciones en production.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPushArgs,
  classifyMigrations,
  GATE_EXIT,
  gateExitCode,
  parseRemoteVersions,
  redactDbUrl,
  validateApplyRequest,
} from "./migrations-logic.mjs";
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

describe("parseRemoteVersions", () => {
  it("extrae versiones remotas de la salida de supabase migration list", () => {
    const output = [
      "                   LOCAL          │     REMOTE     │     TIME (UTC)",
      "  ──────────────────────────────┼────────────────┼──────────────────────",
      "   20260101000000                │ 20260101000000 │ 2026-01-01 00:00:00",
      "   20260102000000                │ 20260102000000 │ 2026-01-02 00:00:00",
      "   20260103000000                │                │ 2026-01-03 00:00:00",
      "   Sin relación                  │ 20251231235959 │ 2025-12-31 23:59:59",
    ].join("\n");
    assert.deepEqual(parseRemoteVersions(output), ["20251231235959", "20260101000000", "20260102000000"]);
  });

  it("acepta separadores | ASCII y devuelve vacío sin tabla", () => {
    assert.deepEqual(parseRemoteVersions(" 20260101000000 | 20260101000000 | x"), ["20260101000000"]);
    assert.deepEqual(parseRemoteVersions("Connecting to remote database...\nNo migrations"), []);
  });
});

describe("classifyMigrations", () => {
  const A = "20260101000000";
  const B = "20260102000000";
  const C = "20260103000000";

  it("up-to-date cuando local y remoto coinciden", () => {
    assert.deepEqual(classifyMigrations([A, B], [A, B]), { status: "up-to-date", pending: [], remoteOnly: [] });
  });

  it("pending cuando faltan versiones locales en remoto", () => {
    assert.deepEqual(classifyMigrations([A, B, C], [A]), { status: "pending", pending: [B, C], remoteOnly: [] });
  });

  it("drift cuando hay versiones solo en remoto", () => {
    assert.deepEqual(classifyMigrations([A], [A, C]), { status: "drift", pending: [], remoteOnly: [C] });
  });

  it("drift tiene prioridad cuando también hay pendientes", () => {
    const result = classifyMigrations([A, B], [C]);
    assert.equal(result.status, "drift");
    assert.deepEqual(result.pending, [A, B]);
    assert.deepEqual(result.remoteOnly, [C]);
  });
});

describe("gateExitCode", () => {
  it("devuelve 0 si está al día, 2 si hay pendientes y 1 si hay drift o error", () => {
    assert.equal(gateExitCode("up-to-date"), 0);
    assert.equal(gateExitCode("pending"), 2);
    assert.equal(gateExitCode("drift"), 1);
    assert.equal(GATE_EXIT.error, 1);
    assert.equal(GATE_EXIT.pending, 2);
    assert.equal(GATE_EXIT.upToDate, 0);
  });
});
