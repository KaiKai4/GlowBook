import assert from "node:assert/strict";
import { it } from "node:test";
import path from "node:path";
import { isStackWorkdirMatch } from "./supabase-env.mjs";

it("acepta el checkout registrado por Docker aunque se limpien temporales", () => {
  const root = path.resolve("glowbook");
  assert.equal(isStackWorkdirMatch(root, root), true);
  assert.equal(isStackWorkdirMatch(path.join(root, "."), root), true);
});

it("rechaza stacks de otro checkout, subdirectorios y etiquetas ausentes", () => {
  const root = path.resolve("glowbook");
  for (const workdir of [undefined, null, "", path.resolve("otro-checkout"), path.join(root, "nested")]) {
    assert.equal(isStackWorkdirMatch(workdir, root), false);
  }
});
