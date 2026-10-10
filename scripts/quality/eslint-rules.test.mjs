// Pruebas de las reglas propias de ESLint (eslint.config.mjs) sobre fragmentos de codigo.
// Comprueba que la regla de consulta Supabase sin error avisa solo cuando debe, y que
// los catch que tragan errores siguen bloqueados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ESLint } from "eslint";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEMO_FILE = "src/features/demo/data/demo.repo.ts";
const SUPABASE_MESSAGE =
  "Consulta Supabase sin error: desestructura { data, error } y lanza el error (if (error) throw error).";
const SWALLOWED_CATCH_PREFIX = "Un .catch que no registra el error oculta fallos.";

const eslint = new ESLint({ cwd: ROOT });

/**
 * Mensajes de no-restricted-syntax que ESLint produce para un fragmento de codigo.
 * @param {string} code
 * @returns {Promise<string[]>}
 */
async function restrictedMessages(code) {
  const [result] = await eslint.lintText(code, { filePath: DEMO_FILE });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-syntax")
    .map((message) => message.message);
}

test("avisa de una consulta Supabase que desestructura data sin error", async () => {
  const messages = await restrictedMessages(
    `export async function load(supabase) {\n  const { data } = await supabase.from("x").select("*");\n  return data;\n}\n`
  );
  assert.deepEqual(messages, [SUPABASE_MESSAGE]);
});

test("avisa tambien de rpc sin error", async () => {
  const messages = await restrictedMessages(
    `export async function load(supabase) {\n  const { data } = await supabase.rpc("fn", {});\n  return data;\n}\n`
  );
  assert.deepEqual(messages, [SUPABASE_MESSAGE]);
});

test("no avisa cuando la consulta desestructura tambien error", async () => {
  const messages = await restrictedMessages(
    `export async function load(supabase) {\n  const { data, error } = await supabase.from("x").select("*");\n  if (error) throw error;\n  return data;\n}\n`
  );
  assert.deepEqual(messages, []);
});

test("sigue bloqueando un .catch que traga el error", async () => {
  const messages = await restrictedMessages(
    `export function load(promise) {\n  void promise.catch(() => null);\n}\n`
  );
  assert.equal(messages.length, 1);
  assert.ok(messages[0].startsWith(SWALLOWED_CATCH_PREFIX), messages[0]);
});
