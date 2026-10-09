/**
 * Reglas de arquitectura (dependency-cruiser) para src/.
 *
 * Reglas de capa expresadas por PATRON (sin listas de archivos ni excepciones):
 *   src/infra          infraestructura: no sube a features, app, components ni React.
 *   src/features/*     modulos de negocio: domain puro, data sin orquestacion, use-cases sin UI,
 *                      y acceso entre modulos solo via index.ts publico.
 *   src/app            rutas y acciones. Solo src/app/_composition (composition root) puede
 *                      depender del runtime de Supabase; el resto solo importa tipos.
 *   src/infra/supabase/admin|auth-admin: solo desde src/infra o features/*\/data.
 *
 * Si una regla falla, se corrige el codigo o, como deuda existente, se congela en
 * .dependency-cruiser-known-violations.json (generado, nunca editado a mano).
 *
 * Ejecutar: npx depcruise src --config .dependency-cruiser.cjs
 */

/** Dependencias npm, sobre el path resuelto (node_modules/<paquete>/...). */
const NPM_UI = "^node_modules/(react|react-dom)/";
const NPM_DOMAIN_FORBIDDEN = "^node_modules/(react|react-dom|next|server-only|@supabase/[^/]+)/";
const NPM_SUPABASE = "^node_modules/@supabase/";
const NPM_NEXT_NAVIGATION = "^node_modules/next/navigation";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "No se permiten dependencias circulares entre modulos de src/.",
      from: {},
      to: { circular: true },
    },
    {
      name: "infra-no-upward",
      severity: "error",
      comment:
        "src/infra no importa orquestacion (features), rutas (app), UI (components) ni React. next/headers y next/cache son infra de servidor y estan permitidos.",
      from: { path: "^src/infra/" },
      to: { path: `^src/(features|app|components)/|${NPM_UI}` },
    },
    {
      name: "domain-pure",
      severity: "error",
      comment:
        "El dominio (src/features/*/domain) es puro: no importa use-cases, data, app, components, src/infra/supabase, React, Next, Supabase ni server-only.",
      from: { path: "^src/features/[^/]+/domain/" },
      to: {
        path: `^src/features/[^/]+/(use-cases|data)/|^src/(app|components)/|^src/infra/supabase/|${NPM_DOMAIN_FORBIDDEN}`,
      },
    },
    {
      name: "data-no-upward",
      severity: "error",
      comment:
        "Los repositorios (src/features/*/data) no importan use-cases, app, components ni React.",
      from: { path: "^src/features/[^/]+/data/" },
      to: { path: `^src/features/[^/]+/use-cases/|^src/(app|components)/|${NPM_UI}` },
    },
    {
      name: "cross-module-via-index",
      severity: "error",
      comment:
        "Un modulo de src/features/X solo importa de src/features/Y a traves de src/features/Y/index.ts (el mismo modulo se permite).",
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
        "Los use-cases orquestan logica de negocio: no importan React, components, app ni next/navigation.",
      from: { path: "^src/features/[^/]+/use-cases/" },
      to: { path: `${NPM_UI}|^src/(components|app)/|${NPM_NEXT_NAVIGATION}` },
    },
    {
      name: "presentation-no-runtime-db",
      severity: "error",
      comment:
        "La capa de presentacion (app, components) solo importa Supabase como type-only. src/app/_composition es el composition root y queda fuera de la regla.",
      from: { path: "^src/(app|components)/", pathNot: "^src/app/_composition/" },
      to: {
        path: `${NPM_SUPABASE}|^src/infra/supabase/`,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "admin-client-boundary",
      severity: "error",
      comment:
        "Los clientes admin (service_role) de src/infra/supabase solo se importan desde src/infra o desde features/*/data.",
      from: { path: "^src/", pathNot: "^src/infra/|^src/features/[^/]+/data/" },
      to: { path: "^src/infra/supabase/(admin|auth-admin)\\.tsx?$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.tsx?$|^src/test/)" },
    includeOnly: "^(src/|node_modules/(react|react-dom|next|server-only|@supabase)/)",
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};
