/**
 * Reglas de arquitectura (dependency-cruiser) para src/.
 *
 * Reglas de capa expresadas por PATRON (sin listas de archivos ni excepciones):
 *   src/infra          infraestructura: no sube a features, app, components ni React.
 *   src/features/*     modulos de negocio: domain puro (solo infra/format, public-error y result
 *                      de src/infra), data sin orquestacion, use-cases sin UI y sin acceso directo
 *                      a Supabase (ese acceso va por data/), y acceso entre modulos solo via
 *                      index.ts publico.
 *   src/app            rutas y acciones. Solo src/app/_composition (composition root) puede
 *                      depender del runtime de Supabase; el resto solo importa tipos.
 *   src/app y src/components  importan de features solo via index.ts (o schemas.ts, domain/).
 *                      Los use-cases y data/ no se importan ni como tipo: sus tipos se exportan
 *                      por el index.ts del modulo. src/components sigue las mismas reglas que src/app.
 *   src/infra/supabase/admin|auth-admin: solo desde src/infra o features/*\/data.
 *   src/infra/auth/platform-admin-proof: la emision es solo del composition root (type-only fuera).
 *   src/features/billing/data/billing-db: solo lo importan los repos de billing (data/*.repo.ts).
 *
 * Si una regla falla, se corrige el codigo. No hay lista de violaciones conocidas
 * ni excepciones por archivo (ver docs/adr, ADR de arquitectura por capas).
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
        "El dominio (src/features/*/domain) es puro: no importa use-cases, data, app, components, React, Next, Supabase ni server-only. De src/infra solo permite lo puro (format, public-error, result).",
      from: { path: "^src/features/[^/]+/domain/" },
      to: {
        path: `^src/features/[^/]+/(use-cases|data)/|^src/(app|components)/|^src/infra/(?!(format/|public-error\\.|result\\.))|${NPM_DOMAIN_FORBIDDEN}`,
      },
    },
    {
      name: "use-cases-no-db",
      severity: "error",
      comment:
        "Los use-cases reciben el acceso a datos por los repositorios (data/): no importan el cliente Supabase (src/infra/supabase) ni @supabase/*.",
      from: { path: "^src/features/[^/]+/use-cases/" },
      to: { path: `^src/infra/supabase/|${NPM_SUPABASE}` },
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
      name: "app-via-feature-index",
      severity: "error",
      comment:
        "src/app y src/components importan de src/features/X solo a traves de index.ts. Quedan permitidos schemas.ts, domain/ (dominio puro, para componentes cliente) y los imports solo de tipos (salvo use-cases/ y data/, ver app-via-feature-index-no-type-exemption).",
      from: { path: "^src/(app|components)/" },
      to: {
        path: "^src/features/[^/]+/",
        pathNot:
          "^src/features/[^/]+/(index|schemas)\\.tsx?$|^src/features/[^/]+/(domain|use-cases|data)/",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "app-via-feature-index-no-type-exemption",
      severity: "error",
      comment:
        "Los imports de use-cases/ y data/ desde src/app o src/components quedan prohibidos incluso si son solo de tipo: los tipos se exportan por index.ts del modulo.",
      from: { path: "^src/(app|components)/" },
      to: {
        path: "^src/features/[^/]+/(use-cases|data)/",
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
      name: "platform-admin-proof-issuer",
      severity: "error",
      comment:
        "La prueba PlatformAdminProof (src/infra/auth/platform-admin-proof) solo la emite el composition root (src/app/_composition) y src/infra/auth. Fuera de ellos solo se permite importar el tipo (type-only).",
      from: { path: "^src/", pathNot: "^src/app/_composition/|^src/infra/auth/" },
      to: {
        path: "^src/infra/auth/platform-admin-proof\\.tsx?$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "billing-db-importers",
      severity: "error",
      comment:
        "billingDb() (service_role de billing, src/features/billing/data/billing-db) solo lo importan los repos de billing (data/*.repo.ts). Ningun otro modulo ni use-case lo usa: el acceso de plataforma pasa por platformDb(proof) (ADR 0028).",
      from: { path: "^src/", pathNot: "^src/features/billing/data/[^/]+\\.repo\\.ts$" },
      to: { path: "^src/features/billing/data/billing-db\\.tsx?$" },
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
