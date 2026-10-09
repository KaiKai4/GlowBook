/**
 * Reglas de arquitectura (dependency-cruiser) para src/.
 *
 * Complementan a scripts/check-architecture.mjs con reglas de grafo:
 * ciclos, dirección de capas y aislamiento de módulos de negocio.
 *
 * Sin excepciones por archivo: si una regla falla, se corrige el código o,
 * como deuda existente, se congela en .dependency-cruiser-known-violations.json
 * (generado por el paso de calidad, nunca editado a mano para esconder hallazgos).
 *
 * Ejecutar: npx depcruise src --config .dependency-cruiser.cjs
 */

/** Dependencias npm, sobre el path resuelto (node_modules/<paquete>/...). */
const NPM_REACT = "^node_modules/(react|react-dom)/";
const NPM_REACT_NEXT_SUPABASE = "^node_modules/(react|react-dom|next|@supabase/[^/]+)/";
const NPM_SUPABASE = "^node_modules/@supabase/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "No se permiten dependencias circulares entre módulos de src/.",
      from: {},
      to: { circular: true },
    },
    {
      name: "infra-no-upward",
      severity: "error",
      comment:
        "La infraestructura (src/lib) no importa orquestación (features), rutas (app), UI (components) ni React. next/headers y next/cache son infra de servidor y están permitidos.",
      from: { path: "^src/lib/" },
      to: {
        path: `^src/(features|app|components)/|${NPM_REACT}`,
      },
    },
    {
      name: "domain-isolation",
      severity: "error",
      comment:
        "El dominio (src/features/*/domain) es puro: no importa use-cases, data, app, components, React, Next ni Supabase.",
      from: { path: "^src/features/[^/]+/domain/" },
      to: {
        path: `^src/(features/[^/]+/(use-cases|data)/|app/|components/)|${NPM_REACT_NEXT_SUPABASE}`,
      },
    },
    {
      name: "domain-isolation-cross-module",
      severity: "error",
      comment:
        "El dominio solo importa de otro módulo a través de su index.ts público (mismo módulo se permite con $1).",
      from: { path: "^src/features/([^/]+)/domain/" },
      to: {
        path: "^src/features/[^/]+/",
        pathNot: "^src/features/$1/|^src/features/[^/]+/index\\.tsx?$",
      },
    },
    {
      name: "cross-module-via-index",
      severity: "error",
      comment:
        "Un módulo de src/features/X solo importa de src/features/Y a través de src/features/Y/index.ts.",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/[^/]+/",
        pathNot: "^src/features/$1/|^src/features/[^/]+/index\\.tsx?$",
      },
    },
    {
      name: "use-cases-no-ui",
      severity: "error",
      comment:
        "Los use-cases orquestan lógica de negocio: no importan React, componentes, rutas Next ni hooks/archivos de UI.",
      from: { path: "^src/features/[^/]+/use-cases/" },
      to: {
        path: `${NPM_REACT}|^src/(components|app)/|^src/.*hooks?/|^src/.*use-[a-z-]+\\.tsx?$`,
      },
    },
    {
      name: "presentation-no-runtime-db",
      severity: "error",
      comment:
        "La capa de presentación (app, components) no usa Supabase en runtime; solo importaciones de tipos (type-only).",
      from: { path: "^src/(app|components)/" },
      to: {
        path: `${NPM_SUPABASE}|^src/lib/supabase/`,
        dependencyTypesNot: ["type-only"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.tsx?$|^src/test/)" },
    includeOnly: "^(src/|node_modules/(react|react-dom|next|@supabase)/)",
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
