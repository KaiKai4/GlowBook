// Guardia de destino para scripts que escriben en una base de datos.
//
// Reglas:
// - Nunca produccion: GLOWBOOK_ENV=production o URL igual a PRODUCTION_SUPABASE_URL (o mismo project-ref).
// - Local (localhost, 127.0.0.1, [::1], *.localhost): permitido sin confirmacion.
// - Remoto: exige --confirm=<project-ref> igual al ref extraido de https://<ref>.supabase.co.
//
// Funciones puras: el llamador pasa los valores de entorno y argv.

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const SUPABASE_SUFFIX = ".supabase.co";
const CONFIRM_PREFIX = "--confirm=";

export class TargetGuardError extends Error {}

/**
 * @typedef {{
 *   url: string | undefined,
 *   env?: string | undefined,
 *   confirmFlag?: string | null,
 *   productionUrl?: string | undefined
 * }} TargetOptions
 * @typedef {{ kind: "local" | "remote", ref: string | null }} TargetResult
 */

/**
 * @param {string} value
 * @returns {URL}
 */
function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    throw new TargetGuardError("La URL de Supabase no es valida.");
  }
}

/**
 * Devuelve el project-ref de una URL https://<ref>.supabase.co, o null si no tiene ese formato.
 * @param {string | undefined} url
 * @returns {string | null}
 */
function extractProjectRef(url) {
  if (!url) return null;
  const hostname = parseUrl(url).hostname.toLowerCase();
  if (!hostname.endsWith(SUPABASE_SUFFIX)) return null;
  const ref = hostname.slice(0, -SUPABASE_SUFFIX.length);
  return /^[a-z0-9]+$/.test(ref) ? ref : null;
}

/**
 * @param {string | undefined} url
 * @returns {boolean}
 */
function isLocalUrl(url) {
  if (!url) return false;
  const hostname = parseUrl(url).hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * Lee el valor de --confirm=<ref> desde argv.
 * @param {readonly string[]} argv
 * @returns {string | null}
 */
export function readConfirmFlag(argv) {
  const flag = argv.find((arg) => arg.startsWith(CONFIRM_PREFIX));
  return flag ? flag.slice(CONFIRM_PREFIX.length) : null;
}

/**
 * Lanza TargetGuardError si el destino no es seguro para escribir.
 * @param {TargetOptions} options
 * @returns {TargetResult}
 */
function assertSafeTarget({ url, env, confirmFlag, productionUrl }) {
  if (!url) throw new TargetGuardError("Falta la URL de Supabase.");
  const normalizedUrl = url.replace(/\/+$/, "").toLowerCase();

  if ((env ?? "").trim().toLowerCase() === "production") {
    throw new TargetGuardError("Rechazado: GLOWBOOK_ENV=production.");
  }
  if (productionUrl) {
    const normalizedProduction = productionUrl.replace(/\/+$/, "").toLowerCase();
    const productionRef = extractProjectRef(productionUrl);
    const sameUrl = normalizedUrl === normalizedProduction;
    const sameRef = productionRef !== null && productionRef === extractProjectRef(url);
    if (sameUrl || sameRef) {
      throw new TargetGuardError("Rechazado: la URL coincide con PRODUCTION_SUPABASE_URL.");
    }
  }

  if (isLocalUrl(url)) return { kind: "local", ref: null };

  const ref = extractProjectRef(url);
  if (ref === null) {
    throw new TargetGuardError("Rechazado: destino remoto sin project-ref reconocible (se espera https://<ref>.supabase.co).");
  }
  if (confirmFlag !== ref) {
    throw new TargetGuardError(`Destino remoto: pasa --confirm=${ref} para confirmar el proyecto.`);
  }
  return { kind: "remote", ref };
}

/**
 * Ejecuta assertSafeTarget y, si falla, imprime el motivo con la etiqueta y termina el proceso.
 * @param {string} label nombre del script para el mensaje
 * @param {TargetOptions} options
 * @returns {TargetResult}
 */
export function assertSafeTargetOrExit(label, options) {
  try {
    return assertSafeTarget(options);
  } catch (error) {
    if (!(error instanceof TargetGuardError)) throw error;
    console.error(`[${label}] ${error.message}`);
    process.exit(1);
  }
}

/**
 * Condiciones para db-push-guarded: automatizacion de release explicita, confirmacion
 * con el project-ref del destino y proyecto enlazado de la CLI coincidente.
 * @param {{ releaseAutomation: string | undefined, confirmFlag: string | null, url: string | undefined, linkedRef: string | null }} input
 * @returns {{ ref: string }}
 */
export function assertReleaseAutomation({ releaseAutomation, confirmFlag, url, linkedRef }) {
  if (releaseAutomation !== "true") {
    throw new TargetGuardError("Negado: requiere GLOWBOOK_RELEASE_AUTOMATION=true.");
  }
  const ref = extractProjectRef(url);
  if (ref === null) {
    throw new TargetGuardError("Negado: la URL de Supabase no tiene project-ref reconocible.");
  }
  if (confirmFlag !== ref) {
    throw new TargetGuardError(`Negado: pasa --confirm=${ref} para confirmar el proyecto destino.`);
  }
  if (linkedRef !== ref) {
    throw new TargetGuardError("Negado: el proyecto enlazado de la CLI de Supabase no coincide con el destino.");
  }
  return { ref };
}
