// Pruebas de conducta del límite absoluto de tamaño de módulos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countLines, findOversizedFiles, MAX_LINES, parseExceptions } from "./check-module-size.mjs";

test("countLines no cuenta el salto final como línea extra", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("a\nb\n"), 2);
  assert.equal(countLines("a\r\nb\r\n"), 2);
  assert.equal(countLines("a\nb"), 2);
});

test("el límite es de 300 líneas", () => {
  assert.equal(MAX_LINES, 300);
});

test("findOversizedFiles marca cualquier archivo por encima del límite, sin baseline", () => {
  const sizes = new Map([
    ["src/a.ts", 300],
    ["src/b.ts", 301],
    ["scripts/c.mjs", 900],
  ]);
  assert.deepEqual(findOversizedFiles(sizes, new Set()), [
    { file: "scripts/c.mjs", lines: 900 },
    { file: "src/b.ts", lines: 301 },
  ]);
});

test("findOversizedFiles respeta solo las excepciones permanentes", () => {
  const sizes = new Map([["src/types/database.types.ts", 5000]]);
  assert.deepEqual(findOversizedFiles(sizes, new Set(["src/types/database.types.ts"])), []);
  assert.deepEqual(findOversizedFiles(sizes, new Set()), [{ file: "src/types/database.types.ts", lines: 5000 }]);
});

test("parseExceptions exige path y reason no vacío", () => {
  const exists = () => true;
  assert.throws(() => parseExceptions([{ path: "src/a.ts" }], exists), /path y reason/);
  assert.throws(() => parseExceptions([{ path: "src/a.ts", reason: "  " }], exists), /path y reason/);
  assert.throws(() => parseExceptions({}, exists), /array/);
});

test("parseExceptions rechaza excepciones que apuntan a archivos inexistentes", () => {
  assert.throws(
    () => parseExceptions([{ path: "src/gone.ts", reason: "x" }], () => false),
    /obsoleta/,
  );
});

test("parseExceptions devuelve el conjunto de rutas", () => {
  const set = parseExceptions([{ path: "src/a.ts", reason: "generado" }], () => true);
  assert.deepEqual([...set], ["src/a.ts"]);
});

test("una lista vacía o ausente no produce excepciones", () => {
  assert.equal(parseExceptions([], () => true).size, 0);
  assert.equal(parseExceptions(undefined, () => true).size, 0);
});
