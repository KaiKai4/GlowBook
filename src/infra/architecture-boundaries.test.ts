// Límites de arquitectura verificados con la API de dependency-cruiser.
// Complementa .dependency-cruiser.cjs: aquí se afirman las dos invariantes de
// capas que más daño hacen si se rompen (infra hacia arriba, dominio impuro).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cruise } from "dependency-cruiser";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FEATURES_DIR = path.join(ROOT, "src", "features");

/** Subconjunto de cada dependencia que interesa a las reglas. */
export interface CruisedDependency {
  resolved: string;
}

/** Subconjunto de cada módulo cruzado: archivo fuente y sus dependencias. */
export interface CruisedModule {
  source: string;
  dependencies: CruisedDependency[];
}

/** Una dependencia prohibida encontrada: origen, destino y patrón que la prohíbe. */
export interface ForbiddenDependency {
  from: string;
  to: string;
}

/**
 * Devuelve las dependencias de los módulos cuyo origen cumple `fromPattern`
 * y cuyo destino resuelto cumple alguno de `forbidden`.
 * @param modules módulos cruzados
 * @param fromPattern patrón del archivo de origen
 * @param forbidden patrones de destino prohibidos
 */
export function findForbiddenDependencies(
  modules: readonly CruisedModule[],
  fromPattern: RegExp,
  forbidden: readonly RegExp[],
): ForbiddenDependency[] {
  const found: ForbiddenDependency[] = [];
  for (const entry of modules) {
    if (!fromPattern.test(entry.source)) continue;
    for (const dependency of entry.dependencies) {
      if (forbidden.some((pattern) => pattern.test(dependency.resolved))) {
        found.push({ from: entry.source, to: dependency.resolved });
      }
    }
  }
  return found;
}

/** Infra no sube a orquestación, rutas, UI ni React. */
const INFRA_FORBIDDEN = [
  /^src\/features\//,
  /^src\/app\//,
  /^src\/components\//,
  /^node_modules\/react\//,
  /^node_modules\/react-dom\//,
];

/** El dominio es puro: nada de Next, React ni Supabase. */
const DOMAIN_FORBIDDEN = [
  /^node_modules\/next\//,
  /^node_modules\/react\//,
  /^node_modules\/react-dom\//,
  /^node_modules\/@supabase\//,
];

const INFRA_FROM = /^src\/infra\//;
const DOMAIN_FROM = /^src\/features\/[^/]+\/domain\//;

/** Directorios de dominio de todos los módulos (relativos a la raíz). */
function domainDirectories(): string[] {
  if (!existsSync(FEATURES_DIR)) return [];
  return readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join("src", "features", entry.name, "domain"))
    .filter((relative) => existsSync(path.join(ROOT, relative)));
}

async function cruiseLayers(): Promise<CruisedModule[]> {
  const result = await cruise(["src/infra", ...domainDirectories()], {
    includeOnly: "^(src/|node_modules/(react|react-dom|next|server-only|@supabase)/)",
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.tsx?$|^src/test/)" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  });
  if (typeof result.output === "string") {
    throw new Error("cruise devolvió texto en lugar del grafo de módulos");
  }
  return result.output.modules;
}

describe("findForbiddenDependencies", () => {
  const modules: CruisedModule[] = [
    {
      source: "src/infra/a.ts",
      dependencies: [{ resolved: "src/features/x/index.ts" }, { resolved: "src/infra/b.ts" }],
    },
    {
      source: "src/features/x/domain/d.ts",
      dependencies: [{ resolved: "node_modules/next/server.js" }],
    },
  ];

  it("encuentra destinos prohibidos desde los orígenes que coinciden", () => {
    expect(findForbiddenDependencies(modules, INFRA_FROM, INFRA_FORBIDDEN)).toEqual([
      { from: "src/infra/a.ts", to: "src/features/x/index.ts" },
    ]);
  });

  it("ignora orígenes fuera del patrón aunque su destino esté prohibido", () => {
    expect(findForbiddenDependencies(modules, DOMAIN_FROM, INFRA_FORBIDDEN)).toEqual([]);
  });

  it("detecta next desde el dominio", () => {
    expect(findForbiddenDependencies(modules, DOMAIN_FROM, DOMAIN_FORBIDDEN)).toEqual([
      { from: "src/features/x/domain/d.ts", to: "node_modules/next/server.js" },
    ]);
  });
});

describe("límites de capas en el grafo real", () => {
  const TIMEOUT_MS = 120_000;

  it(
    "src/infra no depende de features, app, components, react ni react-dom",
    async () => {
      const modules = await cruiseLayers();
      expect(modules.some((entry) => INFRA_FROM.test(entry.source))).toBe(true);
      expect(findForbiddenDependencies(modules, INFRA_FROM, INFRA_FORBIDDEN)).toEqual([]);
    },
    TIMEOUT_MS,
  );

  it(
    "el dominio de cada módulo no depende de next, react ni @supabase",
    async () => {
      const modules = await cruiseLayers();
      expect(modules.some((entry) => DOMAIN_FROM.test(entry.source))).toBe(true);
      expect(findForbiddenDependencies(modules, DOMAIN_FROM, DOMAIN_FORBIDDEN)).toEqual([]);
    },
    TIMEOUT_MS,
  );
});
