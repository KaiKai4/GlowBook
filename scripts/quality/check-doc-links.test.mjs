import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAllDocs,
  checkDocText,
  extractBacktickPaths,
  extractRelativeLinks,
  listDocFiles,
  stripFences,
} from "./check-doc-links.mjs";

/**
 * Crea un repo temporal con los ficheros indicados (rutas relativas -> contenido).
 * @param {Record<string, string>} files
 * @returns {string}
 */
function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), "doc-links-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

test("stripFences elimina bloques de código y conserva el resto", () => {
  const text = "antes\r\n```md\r\n[x](no-existe.md)\r\n```\r\ndespués";
  assert.equal(stripFences(text), "antes\n\n\n\ndespués");
});

test("extractRelativeLinks ignora URLs, anclas puras y rutas absolutas, y quita el ancla", () => {
  const text = "[a](https://x.dev) [b](#seccion) [c](/ruta) [d](docs/x.md#apartado) [e](mailto:a@b.c) [f](./y.md)";
  assert.deepEqual(extractRelativeLinks(text), ["docs/x.md", "./y.md"]);
});

test("extractBacktickPaths solo devuelve rutas concretas del repo", () => {
  const text = "`src/infra/result.ts` `docs/adr/` `supabase/migrations/*.sql` `src/features/<mod>/` `scripts/a.mjs` `npm run verify` `package.json`";
  assert.deepEqual(extractBacktickPaths(text), ["src/infra/result.ts", "docs/adr", "scripts/a.mjs"]);
});

test("checkDocText reporta enlaces rotos y rutas inexistentes, y acepta las existentes", () => {
  const root = makeRepo({
    "docs/real.md": "contenido",
    "src/ok.ts": "",
  });
  const file = join(root, "docs", "guia.md");
  writeFileSync(file, "[bien](real.md) [mal](falta.md) `src/ok.ts` `src/falta.ts`");
  const result = checkDocText({ file, text: "[bien](real.md) [mal](falta.md) `src/ok.ts` `src/falta.ts`", root });
  assert.deepEqual(result.broken, [{ from: "docs/guia.md", link: "falta.md" }]);
  assert.deepEqual(result.missing, [{ from: "docs/guia.md", path: "src/falta.ts" }]);
  assert.equal(result.linkCount, 2);
  assert.equal(result.refCount, 2);
  rmSync(root, { recursive: true, force: true });
});

test("checkDocText ignora los enlaces dentro de bloques de código", () => {
  const root = makeRepo({});
  const file = join(root, "a.md");
  const text = "```\n[roto](no.md)\n```\n";
  const result = checkDocText({ file, text, root });
  assert.deepEqual(result.broken, []);
  rmSync(root, { recursive: true, force: true });
});

test("listDocFiles incluye los documentos raíz y docs/**, pero excluye docs/archive", () => {
  const root = makeRepo({
    "README.md": "",
    "SECURITY.md": "",
    "docs/guia.md": "",
    "docs/sub/otra.md": "",
    "docs/archive/viejo.md": "",
    "docs/imagen.png": "",
  });
  const files = listDocFiles(root).map((abs) => abs.slice(root.length + 1).split("\\").join("/")).sort();
  assert.deepEqual(files, ["README.md", "SECURITY.md", "docs/guia.md", "docs/sub/otra.md"]);
  rmSync(root, { recursive: true, force: true });
});

test("checkAllDocs no revisa docs/archive aunque tenga enlaces rotos", () => {
  const root = makeRepo({
    "README.md": "[ok](docs/guia.md)",
    "docs/guia.md": "sin enlaces",
    "docs/archive/viejo.md": "[roto](nada.md) `src/nada.ts`",
  });
  const result = checkAllDocs(root);
  assert.equal(result.files, 2);
  assert.deepEqual(result.broken, []);
  assert.deepEqual(result.missing, []);
  rmSync(root, { recursive: true, force: true });
});
