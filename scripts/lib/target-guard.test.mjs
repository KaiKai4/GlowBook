// Tests de la guardia de destino (node:test, sin red ni base de datos).
// Las reglas de destino se prueban a través de la API pública (assertSafeTargetOrExit y
// assertReleaseAutomation), que es la que usan los scripts.
import { mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  TargetGuardError,
  assertReleaseAutomation,
  assertSafeTargetOrExit,
  readConfirmFlag,
} from "./target-guard.mjs";

const STAGING_REF = "abcdefghijklmnopqrst";
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PROD_REF = "zyxwvutsrqponmlkjihg";
const PROD_URL = `https://${PROD_REF}.supabase.co`;

/** Señal interna para cortar la ejecución cuando el guard llama a process.exit. */
class ExitSignal extends Error {}

/**
 * Ejecuta assertSafeTargetOrExit con process.exit y console.error simulados.
 * @param {Parameters<typeof assertSafeTargetOrExit>[1]} options
 * @returns {{ result: ReturnType<typeof assertSafeTargetOrExit> | null, message: string | null }}
 */
function runGuard(options) {
  /** @type {string[]} */
  const printed = [];
  const exitMock = mock.method(process, "exit", () => {
    throw new ExitSignal("exit");
  });
  const errorMock = mock.method(console, "error", (/** @type {unknown} */ text) => {
    printed.push(String(text));
  });
  try {
    return { result: assertSafeTargetOrExit("test", options), message: null };
  } catch (error) {
    if (!(error instanceof ExitSignal)) throw error;
    return { result: null, message: printed.join("\n") };
  } finally {
    exitMock.mock.restore();
    errorMock.mock.restore();
  }
}

/**
 * @param {Parameters<typeof assertSafeTargetOrExit>[1]} options
 * @returns {string}
 */
function rejectionOf(options) {
  const { message } = runGuard(options);
  assert.notEqual(message, null, "se esperaba un rechazo");
  return message ?? "";
}

/**
 * @param {() => unknown} fn
 * @returns {string}
 */
function errorMessageOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof TargetGuardError, "debe lanzar TargetGuardError");
    return error.message;
  }
  assert.fail("se esperaba un error");
}

test("el ref de una URL de Supabase se extrae y se usa como destino remoto", () => {
  assert.equal(runGuard({ url: STAGING_URL, env: "", confirmFlag: STAGING_REF }).result?.ref, STAGING_REF);
  assert.equal(runGuard({ url: `${STAGING_URL}/`, env: "", confirmFlag: STAGING_REF }).result?.ref, STAGING_REF);
  assert.match(rejectionOf({ url: "https://example.com", env: "staging", confirmFlag: "x" }), /project-ref/);
});

test("hosts locales se reconocen como destino local, el resto como remoto", () => {
  assert.equal(runGuard({ url: "http://127.0.0.1:54321", env: "" }).result?.kind, "local");
  assert.equal(runGuard({ url: "http://localhost:54321", env: "" }).result?.kind, "local");
  assert.equal(runGuard({ url: "http://api.glowbook.localhost", env: "" }).result?.kind, "local");
  assert.equal(runGuard({ url: "http://[::1]:54321", env: "" }).result?.kind, "local");
  assert.equal(runGuard({ url: STAGING_URL, env: "", confirmFlag: STAGING_REF }).result?.kind, "remote");
});

test("readConfirmFlag lee --confirm=<ref> de argv", () => {
  assert.equal(readConfirmFlag(["node", "script.mjs", `--confirm=${STAGING_REF}`]), STAGING_REF);
  assert.equal(readConfirmFlag(["node", "script.mjs"]), null);
});

test("destino local se permite sin confirmacion", () => {
  assert.deepEqual(runGuard({ url: "http://127.0.0.1:54321", env: "" }).result, { kind: "local", ref: null });
});

test("destino remoto exige --confirm igual al project-ref", () => {
  assert.deepEqual(runGuard({ url: STAGING_URL, env: "staging", confirmFlag: STAGING_REF }).result, {
    kind: "remote",
    ref: STAGING_REF,
  });
  assert.match(rejectionOf({ url: STAGING_URL, env: "staging" }), /--confirm=abcdefghijklmnopqrst/);
  assert.match(rejectionOf({ url: STAGING_URL, env: "staging", confirmFlag: PROD_REF }), /--confirm=abcdefghijklmnopqrst/);
});

test("GLOWBOOK_ENV=production se rechaza aunque la URL sea local o confirmada", () => {
  assert.match(rejectionOf({ url: "http://127.0.0.1:54321", env: "production" }), /production/);
  assert.match(rejectionOf({ url: STAGING_URL, env: " PRODUCTION ", confirmFlag: STAGING_REF }), /production/);
});

test("URL igual a PRODUCTION_SUPABASE_URL se rechaza, con o sin barra final", () => {
  assert.match(rejectionOf({ url: PROD_URL, env: "staging", confirmFlag: PROD_REF, productionUrl: PROD_URL }), /PRODUCTION_SUPABASE_URL/);
  assert.match(rejectionOf({ url: `${PROD_URL}/`, env: "", confirmFlag: PROD_REF, productionUrl: PROD_URL }), /PRODUCTION_SUPABASE_URL/);
});

test("URL vacia o invalida se rechaza", () => {
  assert.match(rejectionOf({ url: undefined }), /Falta la URL/);
  assert.match(rejectionOf({ url: "no es una url", confirmFlag: "x" }), /no es valida/);
});

test("assertReleaseAutomation exige automatizacion, confirmacion y proyecto enlazado", () => {
  const base = { releaseAutomation: "true", confirmFlag: STAGING_REF, url: STAGING_URL, linkedRef: STAGING_REF };
  assert.deepEqual(assertReleaseAutomation(base), { ref: STAGING_REF });
  assert.match(errorMessageOf(() => assertReleaseAutomation({ ...base, releaseAutomation: undefined })), /GLOWBOOK_RELEASE_AUTOMATION/);
  assert.match(errorMessageOf(() => assertReleaseAutomation({ ...base, releaseAutomation: "false" })), /GLOWBOOK_RELEASE_AUTOMATION/);
  assert.match(errorMessageOf(() => assertReleaseAutomation({ ...base, confirmFlag: null })), /--confirm/);
  assert.match(errorMessageOf(() => assertReleaseAutomation({ ...base, linkedRef: PROD_REF })), /enlazado/);
  assert.match(errorMessageOf(() => assertReleaseAutomation({ ...base, linkedRef: null })), /enlazado/);
});
