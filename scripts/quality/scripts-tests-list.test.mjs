// Garantiza que el paso "scripts-tests" de steps.mjs ejecuta TODOS los tests de scripts/.
// Si se añade un scripts/**/*.test.mjs sin registrarlo en el paso, esta prueba falla.
import { readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { STEPS } from "./steps.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const TEST_SUFFIX = ".test.mjs";

/**
 * Lista recursiva de scripts/**\/*.test.mjs con rutas relativas a la raíz (separador "/").
 * @param {string} dir
 * @param {string[]} out
 * @returns {string[]}
 */
function collectScriptTests(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectScriptTests(absolute, out);
    } else if (entry.name.endsWith(TEST_SUFFIX)) {
      out.push(path.relative(ROOT, absolute).split(path.sep).join("/"));
    }
  }
  return out;
}

const scriptsTestsStep = STEPS.find((step) => step.id === "scripts-tests");
const listed = (scriptsTestsStep?.cmd ?? []).filter((arg) => arg.endsWith(TEST_SUFFIX));

test("existe el paso scripts-tests en el job unit con node --test", () => {
  assert.ok(scriptsTestsStep, "falta el paso scripts-tests en steps.mjs");
  assert.equal(scriptsTestsStep.tier, "fast");
  assert.deepEqual(scriptsTestsStep.jobs, ["unit"]);
  assert.deepEqual(scriptsTestsStep.cmd.slice(0, 2), ["node", "--test"]);
});

test("todo scripts/**/*.test.mjs esta en la lista del paso scripts-tests", () => {
  const onDisk = collectScriptTests(SCRIPTS_DIR, []);
  const missing = onDisk.filter((file) => !listed.includes(file));
  assert.deepEqual(missing, [], "tests de scripts que el paso scripts-tests no ejecuta");
});

test("la lista del paso no contiene tests inexistentes", () => {
  const onDisk = new Set(collectScriptTests(SCRIPTS_DIR, []));
  const stale = listed.filter((file) => !onDisk.has(file));
  assert.deepEqual(stale, [], "entradas del paso scripts-tests que ya no existen");
});
