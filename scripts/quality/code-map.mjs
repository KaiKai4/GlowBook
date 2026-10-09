// Mapa de código por módulo, derivado del grafo real de dependency-cruiser.
//
// Genera (versionados, nunca se editan a mano):
//   docs/code-map/modules.mmd  diagrama Mermaid: un nodo por módulo, agrupado por capa
//   docs/code-map/graph.json   el mismo grafo en JSON (nodos y aristas agregadas)
//
// Un "módulo" es: features/<mod>, infra/<sub>, app/<grupo de rutas>, components/<sub>
// o npm/<paquete>. El grafo se reduce a módulos: las aristas de archivo se agregan
// y se cuentan (count = número de imports entre archivos de ambos módulos).
//
// Uso:
//   node scripts/quality/code-map.mjs            regenera los dos archivos
//   node scripts/quality/code-map.mjs --check    falla si lo versionado no coincide
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "docs", "code-map");
const MMD_FILE = path.join(OUT_DIR, "modules.mmd");
const JSON_FILE = path.join(OUT_DIR, "graph.json");
const HEADER = "%% Generado por scripts/quality/code-map.mjs. No editar a mano.";

/**
 * @typedef {{ id: string, kind: "internal" | "npm", files: number }} CodeMapNode
 * @typedef {{ from: string, to: string, count: number }} CodeMapEdge
 * @typedef {{ nodes: CodeMapNode[], edges: CodeMapEdge[] }} CodeMapGraph
 * @typedef {{ source: string, dependencies: { resolved?: string, coreModule?: boolean }[] }} CruisedModule
 */

/** @param {string} value @returns {string} */
function toPosix(value) {
  return value.split(path.sep).join("/").replace(/\\/g, "/");
}

/**
 * Clave de módulo de un archivo resuelto por dependency-cruiser.
 * @param {string} resolved ruta relativa a la raíz, p. ej. "src/features/x/domain/a.ts"
 * @returns {string}
 */
export function moduleKeyOf(resolved) {
  const normalized = toPosix(resolved);
  if (normalized.startsWith("node_modules/")) {
    const parts = normalized.slice("node_modules/".length).split("/");
    const name = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
    return `npm/${name}`;
  }
  const parts = normalized.replace(/^src\//, "").split("/");
  const [top, second] = parts;
  if (top === "features") return parts.length > 2 ? `features/${second}` : "features";
  if (top === "infra") return parts.length > 2 ? `infra/${second}` : "infra";
  if (top === "app") {
    if (second === "_composition") return "app/_composition";
    return parts.length > 2 ? `app/${second}` : "app";
  }
  if (top === "components") return parts.length > 2 ? `components/${second}` : "components";
  return parts.length > 1 ? top : "src";
}

/**
 * Agrega el grafo de archivos en grafo de módulos. Sin dependencias del sistema
 * de archivos: recibe los módulos ya cruzados.
 * @param {readonly CruisedModule[]} modules
 * @returns {CodeMapGraph}
 */
export function buildGraph(modules) {
  /** @type {Map<string, { kind: "internal" | "npm", files: number }>} */
  const nodes = new Map();
  /** @type {Map<string, number>} */
  const edges = new Map();

  /** @param {string} id @param {"internal" | "npm"} kind @returns {{ kind: "internal" | "npm", files: number }} */
  const touch = (id, kind) => {
    const current = nodes.get(id);
    if (current) return current;
    const created = { kind, files: 0 };
    nodes.set(id, created);
    return created;
  };

  for (const entry of modules) {
    const from = moduleKeyOf(entry.source);
    touch(from, "internal").files += 1;
    for (const dependency of entry.dependencies) {
      if (!dependency.resolved || dependency.coreModule) continue;
      const resolved = toPosix(dependency.resolved);
      const to = moduleKeyOf(resolved);
      if (to === from) continue;
      touch(to, resolved.startsWith("node_modules/") ? "npm" : "internal");
      const key = `${from}\u0000${to}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  const nodeList = [...nodes]
    .map(([id, value]) => ({ id, kind: value.kind, files: value.files }))
    .sort((a, b) => compare(a.id, b.id));
  const edgeList = [...edges]
    .map(([key, count]) => {
      const [from, to] = key.split("\u0000");
      return { from, to, count };
    })
    .sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to));
  return { nodes: nodeList, edges: edgeList };
}

/** @param {string} a @param {string} b @returns {number} */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** @param {string} id @returns {string} */
function mermaidId(id) {
  return id.replace(/[^A-Za-z0-9]/g, "_");
}

/** @param {CodeMapGraph} graph @returns {string} */
export function renderMermaid(graph) {
  /** @type {Map<string, CodeMapNode[]>} */
  const groups = new Map();
  for (const node of graph.nodes) {
    const group = node.id.split("/")[0];
    groups.set(group, [...(groups.get(group) ?? []), node]);
  }
  const lines = [HEADER, "flowchart LR"];
  for (const [group, nodes] of [...groups].sort(([a], [b]) => compare(a, b))) {
    lines.push(`  subgraph g_${mermaidId(group)}["${group}"]`);
    for (const node of nodes) {
      const label = node.kind === "internal" ? `${node.id} (${node.files})` : node.id;
      lines.push(`    ${mermaidId(node.id)}["${label}"]`);
    }
    lines.push("  end");
  }
  for (const edge of graph.edges) {
    lines.push(`  ${mermaidId(edge.from)} --> ${mermaidId(edge.to)}`);
  }
  return `${lines.join("\n")}\n`;
}

/** @param {CodeMapGraph} graph @returns {string} */
export function renderGraphJson(graph) {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

/**
 * Cruza src/ con la configuración versionada (sin reglas: solo el grafo).
 * @returns {Promise<CruisedModule[]>}
 */
async function cruiseSource() {
  const requireConfig = createRequire(import.meta.url);
  /** @type {{ options: Record<string, unknown> }} */
  const config = requireConfig(path.join(ROOT, ".dependency-cruiser.cjs"));
  // dependency-cruiser resuelve rutas y tsconfig.json respecto al cwd: se fija a la raíz.
  process.chdir(ROOT);
  const result = await cruise(["src"], { ...config.options, validate: false });
  if (typeof result.output === "string") {
    throw new Error("dependency-cruiser devolvió texto en lugar del grafo");
  }
  return result.output.modules;
}

/** @returns {Promise<{ path: string, content: string }[]>} */
async function generateArtifacts() {
  const graph = buildGraph(await cruiseSource());
  return [
    { path: MMD_FILE, content: renderMermaid(graph) },
    { path: JSON_FILE, content: renderGraphJson(graph) },
  ];
}

/**
 * Compara ignorando el fin de línea (el repo versiona LF).
 * @param {string | null} current
 * @param {string} expected
 * @returns {boolean}
 */
export function isUpToDate(current, expected) {
  return current !== null && current.replace(/\r\n/g, "\n") === expected;
}

/** @returns {Promise<void>} */
async function main() {
  const check = process.argv.slice(2).includes("--check");
  const artifacts = await generateArtifacts();
  if (check) {
    const stale = artifacts.filter(({ path: file, content }) => {
      const current = existsSync(file) ? readFileSync(file, "utf8") : null;
      return !isUpToDate(current, content);
    });
    if (stale.length > 0) {
      for (const { path: file } of stale) {
        console.error(`[code-map] desactualizado: ${toPosix(path.relative(ROOT, file))}`);
      }
      console.error("[code-map] Regenera con: node scripts/quality/code-map.mjs");
      process.exitCode = 1;
      return;
    }
    console.log("[code-map] docs/code-map al día con el grafo de dependencias.");
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const { path: file, content } of artifacts) {
    writeFileSync(file, content, "utf8");
    console.log(`[code-map] escrito ${toPosix(path.relative(ROOT, file))}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
