// Pruebas de conducta del generador del mapa de código (sin depender del disco).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, isUpToDate, moduleKeyOf, renderGraphJson, renderMermaid } from "./code-map.mjs";

test("moduleKeyOf agrupa features por módulo, sin importar la capa", () => {
  assert.equal(moduleKeyOf("src/features/appointments/domain/x.ts"), "features/appointments");
  assert.equal(moduleKeyOf("src/features/appointments/index.ts"), "features/appointments");
});

test("moduleKeyOf agrupa infra por subcarpeta y los archivos sueltos en infra", () => {
  assert.equal(moduleKeyOf("src/infra/supabase/server.ts"), "infra/supabase");
  assert.equal(moduleKeyOf("src/infra/result.ts"), "infra");
});

test("moduleKeyOf distingue composition root, grupos de rutas y componentes", () => {
  assert.equal(moduleKeyOf("src/app/_composition/request-context.ts"), "app/_composition");
  assert.equal(moduleKeyOf("src/app/(dashboard)/appointments/actions.ts"), "app/(dashboard)");
  assert.equal(moduleKeyOf("src/app/layout.tsx"), "app");
  assert.equal(moduleKeyOf("src/components/ui/button.tsx"), "components/ui");
});

test("moduleKeyOf agrupa paquetes npm, incluidos los de ámbito", () => {
  assert.equal(moduleKeyOf("node_modules/next/server.js"), "npm/next");
  assert.equal(moduleKeyOf("node_modules/@supabase/ssr/dist/index.js"), "npm/@supabase/ssr");
});

test("moduleKeyOf normaliza separadores de Windows", () => {
  assert.equal(moduleKeyOf("src\\features\\billing\\data\\repo.ts"), "features/billing");
});

const MODULES = [
  {
    source: "src/features/appointments/use-cases/a.ts",
    dependencies: [
      { resolved: "src/features/appointments/domain/x.ts" },
      { resolved: "src/features/billing/index.ts" },
      { resolved: "src/features/billing/index.ts" },
      { resolved: "node_modules/next/server.js" },
      { resolved: "node_modules/fs/index.js", coreModule: true },
    ],
  },
  {
    source: "src/features/appointments/domain/x.ts",
    dependencies: [],
  },
  {
    source: "src/features/billing/index.ts",
    dependencies: [{ resolved: "src/features/appointments/domain/x.ts" }],
  },
];

test("buildGraph cuenta archivos por módulo y agrega aristas entre módulos", () => {
  const graph = buildGraph(MODULES);
  assert.deepEqual(graph.nodes, [
    { id: "features/appointments", kind: "internal", files: 2 },
    { id: "features/billing", kind: "internal", files: 1 },
    { id: "npm/next", kind: "npm", files: 0 },
  ]);
  assert.deepEqual(graph.edges, [
    { from: "features/appointments", to: "features/billing", count: 2 },
    { from: "features/appointments", to: "npm/next", count: 1 },
    { from: "features/billing", to: "features/appointments", count: 1 },
  ]);
});

test("buildGraph ignora dependencias internas al mismo módulo y módulos centrales de Node", () => {
  const graph = buildGraph([
    { source: "src/infra/a.ts", dependencies: [{ resolved: "src/infra/b.ts" }] },
    { source: "src/infra/c.ts", dependencies: [{ resolved: "node:fs", coreModule: true }] },
  ]);
  assert.deepEqual(graph.edges, []);
});

test("buildGraph es independiente del orden de entrada", () => {
  const forward = buildGraph(MODULES);
  const reversed = buildGraph([...MODULES].reverse());
  assert.deepEqual(reversed, forward);
});

test("renderMermaid produce un diagrama con subgrafos por capa y una arista por relación", () => {
  const mermaid = renderMermaid(buildGraph(MODULES));
  assert.match(mermaid, /^%% Generado por scripts\/quality\/code-map\.mjs/);
  assert.match(mermaid, /^flowchart LR$/m);
  assert.match(mermaid, /subgraph g_features\["features"\]/);
  assert.match(mermaid, /features_appointments\["features\/appointments \(2\)"\]/);
  assert.match(mermaid, /features_appointments --> features_billing/);
  assert.match(mermaid, /features_billing --> features_appointments/);
  assert.match(mermaid, /\n$/);
});

test("renderMermaid y renderGraphJson son deterministas", () => {
  const graph = buildGraph(MODULES);
  assert.equal(renderMermaid(graph), renderMermaid(buildGraph(MODULES)));
  assert.equal(renderGraphJson(graph), renderGraphJson(buildGraph(MODULES)));
  assert.deepEqual(JSON.parse(renderGraphJson(graph)), graph);
});

test("isUpToDate ignora el fin de línea CRLF y falla si falta el archivo", () => {
  assert.equal(isUpToDate("a\r\nb\n", "a\nb\n"), true);
  assert.equal(isUpToDate("a\n", "b\n"), false);
  assert.equal(isUpToDate(null, "a\n"), false);
});
