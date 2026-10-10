// Pruebas de check-bundle-secrets.mjs (node:test). Los valores ficticios se construyen en tiempo de
// ejecución para que ningún fichero del repo contenga algo que parezca un JWT real.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildNeedles, findSecretLeaks, listFiles } from "./check-bundle-secrets.mjs";

const SECRET_ENV = "SUPABASE_SERVICE_ROLE_KEY";
const FAKE_VALUE = ["eyJ", "fixture", "value"].join("-");
/** @type {string[]} */
const tempRoots = [];

/**
 * Crea una carpeta temporal única registrada para limpieza posterior.
 * @returns {string}
 */
function makeTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bundle-secrets-"));
  tempRoots.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

describe("findSecretLeaks", () => {
  test("detecta el nombre literal SUPABASE_SERVICE_ROLE_KEY", () => {
    const files = [{ path: ".next/static/chunks/a.js", content: `const k = process.env.${SECRET_ENV};` }];
    const findings = findSecretLeaks({ files, needles: [{ label: "nombre literal", value: SECRET_ENV }] });
    assert.deepEqual(findings, [{ path: ".next/static/chunks/a.js", needle: "nombre literal" }]);
  });

  test("detecta el valor ficticio del entorno sin imprimirlo en el hallazgo", () => {
    const files = [{ path: "public/app.js", content: `window.x = "${FAKE_VALUE}";` }];
    const findings = findSecretLeaks({ files, needles: buildNeedles({ [SECRET_ENV]: FAKE_VALUE }) });
    assert.deepEqual(findings, [{ path: "public/app.js", needle: `valor de ${SECRET_ENV}` }]);
    assert.ok(!JSON.stringify(findings).includes(FAKE_VALUE));
  });

  test("no da falsos positivos con contenido limpio", () => {
    const files = [
      { path: ".next/static/chunks/b.js", content: "console.log('hola mundo');" },
      { path: "public/logo.svg", content: "<svg></svg>" },
    ];
    const findings = findSecretLeaks({ files, needles: buildNeedles({ [SECRET_ENV]: FAKE_VALUE }) });
    assert.deepEqual(findings, []);
  });

  test("ignora un valor vacío en el entorno", () => {
    const needles = buildNeedles({ [SECRET_ENV]: "   " });
    assert.equal(needles.length, 1);
    const findings = findSecretLeaks({
      files: [{ path: "public/x.txt", content: "texto cualquiera" }],
      needles,
    });
    assert.deepEqual(findings, []);
  });
});

describe("listFiles", () => {
  test("recorre subcarpetas recursivamente", () => {
    const root = makeTempDir();
    mkdirSync(path.join(root, "a", "b"), { recursive: true });
    writeFileSync(path.join(root, "top.txt"), "1");
    writeFileSync(path.join(root, "a", "mid.txt"), "2");
    writeFileSync(path.join(root, "a", "b", "deep.txt"), "3");

    const names = listFiles(root).map((file) => path.relative(root, file).split(path.sep).join("/")).sort();
    assert.deepEqual(names, ["a/b/deep.txt", "a/mid.txt", "top.txt"]);
  });

  test("devuelve una lista vacía si el directorio no existe", () => {
    assert.deepEqual(listFiles(path.join(os.tmpdir(), "bundle-secrets-inexistente-xyz")), []);
  });
});
