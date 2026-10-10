// Límites de arquitectura verificados con la API de dependency-cruiser.
// Complementa .dependency-cruiser.cjs: aquí se afirman las tres invariantes de
// capas que más daño hacen si se rompen (infra hacia arriba, dominio impuro,
// use-cases con acceso directo a la base de datos).
// Los patrones prohibidos se leen de la propia configuración, no se copian aquí,
// para que el test y la regla no puedan divergir.
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cruise } from "dependency-cruiser";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FEATURES_DIR = path.join(ROOT, "src", "features");

interface DepRule {
  name: string;
  to?: { path?: string };
}

const loadDepConfig = createRequire(import.meta.url);
const DEP_CONFIG: { forbidden: DepRule[] } = loadDepConfig(
  path.join(ROOT, ".dependency-cruiser.cjs"),
);

/** Patrón de destino (`to.path`, una cadena de expresión regular) de una regla de .dependency-cruiser.cjs. */
function ruleTarget(name: string): string {
  const pattern = DEP_CONFIG.forbidden.find((rule) => rule.name === name)?.to?.path;
  if (!pattern) throw new Error(`la regla ${name} no tiene to.path en .dependency-cruiser.cjs`);
  return pattern;
}

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
 * @param forbidden patrones de destino prohibidos, en la sintaxis de `to.path` de la configuración
 */
export function findForbiddenDependencies(
  modules: readonly CruisedModule[],
  fromPattern: RegExp,
  forbidden: readonly string[],
): ForbiddenDependency[] {
  const found: ForbiddenDependency[] = [];
  for (const entry of modules) {
    if (!fromPattern.test(entry.source)) continue;
    for (const dependency of entry.dependencies) {
      if (forbidden.some((pattern) => dependency.resolved.search(pattern) !== -1)) {
        found.push({ from: entry.source, to: dependency.resolved });
      }
    }
  }
  return found;
}

/** Infra no sube a orquestación, rutas, UI ni React (regla infra-no-upward). */
const INFRA_FORBIDDEN = [ruleTarget("infra-no-upward")];

/** El dominio es puro (regla domain-pure): nada de Next, React ni Supabase, ni infra impura. */
const DOMAIN_FORBIDDEN = [ruleTarget("domain-pure")];

/** Los use-cases no tocan la base de datos: el acceso va por data/ (regla use-cases-no-db). */
const USE_CASES_DB_FORBIDDEN = [ruleTarget("use-cases-no-db")];

const INFRA_FROM = /^src\/infra\//;
const DOMAIN_FROM = /^src\/features\/[^/]+\/domain\//;
const USE_CASES_FROM = /^src\/features\/[^/]+\/use-cases\//;

/** Directorios `subdir` (domain, use-cases...) de todos los módulos, relativos a la raíz. */
function moduleDirectories(subdir: string): string[] {
  if (!existsSync(FEATURES_DIR)) return [];
  return readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join("src", "features", entry.name, subdir))
    .filter((relative) => existsSync(path.join(ROOT, relative)));
}

async function cruiseLayers(): Promise<CruisedModule[]> {
  const targets = ["src/infra", ...moduleDirectories("domain"), ...moduleDirectories("use-cases")];
  const result = await cruise(targets, {
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

  it("el dominio puede usar format, public-error y result, pero no el resto de infra", () => {
    const domainModules: CruisedModule[] = [
      {
        source: "src/features/x/domain/d.ts",
        dependencies: [
          { resolved: "src/infra/format/dates.ts" },
          { resolved: "src/infra/public-error.ts" },
          { resolved: "src/infra/result.ts" },
          { resolved: "src/infra/errors.ts" },
          { resolved: "src/infra/observability/log.ts" },
        ],
      },
    ];
    expect(findForbiddenDependencies(domainModules, DOMAIN_FROM, DOMAIN_FORBIDDEN)).toEqual([
      { from: "src/features/x/domain/d.ts", to: "src/infra/errors.ts" },
      { from: "src/features/x/domain/d.ts", to: "src/infra/observability/log.ts" },
    ]);
  });

  it("detecta Supabase desde un use-case", () => {
    const useCaseModules: CruisedModule[] = [
      {
        source: "src/features/x/use-cases/uc.ts",
        dependencies: [
          { resolved: "src/infra/supabase/server.ts" },
          { resolved: "node_modules/@supabase/supabase-js/dist/index.js" },
          { resolved: "src/features/x/data/x.repo.ts" },
        ],
      },
    ];
    expect(findForbiddenDependencies(useCaseModules, USE_CASES_FROM, USE_CASES_DB_FORBIDDEN)).toEqual([
      { from: "src/features/x/use-cases/uc.ts", to: "src/infra/supabase/server.ts" },
      { from: "src/features/x/use-cases/uc.ts", to: "node_modules/@supabase/supabase-js/dist/index.js" },
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

  it(
    "los use-cases de cada módulo no dependen de src/infra/supabase ni de @supabase",
    async () => {
      const modules = await cruiseLayers();
      expect(modules.some((entry) => USE_CASES_FROM.test(entry.source))).toBe(true);
      expect(findForbiddenDependencies(modules, USE_CASES_FROM, USE_CASES_DB_FORBIDDEN)).toEqual(
        [],
      );
    },
    TIMEOUT_MS,
  );
});
