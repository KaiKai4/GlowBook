// Entorno de Supabase LOCAL (Docker) para pruebas de calidad.
// Nunca toca staging ni producción: solo invoca el CLI instalado en node_modules
// y lee el estado del stack local. Nunca imprime claves ni URLs con credenciales.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI_ENTRY = path.join(ROOT, "node_modules", "supabase", "dist", "supabase.js");
// Límites de cada llamada al CLI: nunca se espera indefinidamente a supabase.
const DOCKER_TIMEOUT_MS = 30_000;
const STATUS_TIMEOUT_MS = 60_000;
const START_TIMEOUT_MS = 10 * 60_000;

/** @typedef {Record<string, string | undefined>} SupabaseStatus */

const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  /postgres(?:ql)?:\/\/[^@\s]+@/g,
];

/**
 * Oculta claves y credenciales antes de mostrar salida del CLI.
 * @param {string} text
 * @returns {string}
 */
function redact(text) {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, "[REDACTED]"), text);
}

function assertCliInstalled() {
  if (!existsSync(CLI_ENTRY)) {
    throw new Error(
      `No se encuentra el CLI de Supabase en ${CLI_ENTRY}. Ejecuta "npm install".`
    );
  }
}

function assertDockerAvailable() {
  const result = spawnSync("docker", ["info"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: DOCKER_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      "Docker no responde. Arranca Docker Desktop y vuelve a intentarlo (Supabase local lo necesita)."
    );
  }
}

/** @param {string[]} args @param {Omit<import("node:child_process").SpawnSyncOptionsWithStringEncoding, "encoding">} [options] @returns {import("node:child_process").SpawnSyncReturns<string>} */
function runCli(args, options = {}) {
  assertCliInstalled();
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    ...options,
  });
}

/**
 * Estado de "supabase status -o json". Devuelve null si el stack no está arriba.
 * @returns {SupabaseStatus | null}
 */
function readStatus() {
  const result = runCli(["status", "-o", "json"], { timeout: STATUS_TIMEOUT_MS });
  if (isTimeout(result.error)) {
    throw new Error(
      `"supabase status" no respondió en ${STATUS_TIMEOUT_MS / 1000} s. Revisa Docker y los procesos de supabase colgados.`
    );
  }
  if (result.error || result.status !== 0) return null;

  const stdout = result.stdout ?? "";
  const start = stdout.indexOf("{");
  if (start === -1) return null;

  try {
    const parsed = JSON.parse(stdout.slice(start));
    return parsed && typeof parsed === "object" && parsed.API_URL ? parsed : null;
  } catch {
    return null;
  }
}

/** @returns {SupabaseStatus} */
function readStatusOrThrow() {
  const status = readStatus();
  if (!status) {
    throw new Error("Supabase local no está en marcha. Ejecuta \"npm run db:start\".");
  }
  return status;
}

/** @param {Error | undefined} error @returns {boolean} */
function isTimeout(error) {
  return Boolean(error) && /** @type {NodeJS.ErrnoException} */ (error).code === "ETIMEDOUT";
}

/** @param {unknown} workdir @param {string} expectedRoot @returns {boolean} */
export function isStackWorkdirMatch(workdir, expectedRoot) {
  if (typeof workdir !== "string" || workdir.trim() === "") return false;
  const normalize = process.platform === "win32"
    ? (/** @type {string} */ value) => path.resolve(value).toLowerCase()
    : (/** @type {string} */ value) => path.resolve(value);
  return normalize(workdir) === normalize(expectedRoot);
}

/**
 * Extrae project_id de supabase/config.toml. Lanza si no existe.
 * @param {string} configText contenido de supabase/config.toml
 * @returns {string}
 */
export function readProjectId(configText) {
  const projectId = /^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m.exec(configText)?.[1];
  if (!projectId) throw new Error("No se pudo identificar el project_id de Supabase local.");
  return projectId;
}

// La etiqueta de Docker registra el checkout real. No se depende de archivos
// temporales que pueden desaparecer o cambiar entre versiones de Supabase CLI.
function assertStackOwnedByThisCheckout() {
  const config = readFileSync(path.join(ROOT, "supabase", "config.toml"), "utf8");
  const projectId = readProjectId(config);
  const result = spawnSync("docker", [
    "inspect", "supabase_db_" + projectId,
    "--format", '{{index .Config.Labels "com.supabase.cli.workdir"}}',
  ], { encoding: "utf8", shell: false, windowsHide: true, timeout: DOCKER_TIMEOUT_MS });
  if (result.status === 0 && isStackWorkdirMatch(result.stdout.trim(), ROOT)) return;
  throw new Error(
    "El stack Supabase local no acredita este checkout como propietario. " +
    "Detén el stack desde su checkout original y arranca este con npm run db:start."
  );
}

// Garantiza que el stack local está arriba. Idempotente: si ya corre, no hace nada.
export async function ensureLocalSupabase() {
  assertDockerAvailable();
  if (readStatus()) {
    assertStackOwnedByThisCheckout();
    return;
  }

  console.log("Supabase local no está activo; ejecutando \"supabase start\" (puede tardar varios minutos)...");
  const started = runCli(["start"], { timeout: START_TIMEOUT_MS });
  if (isTimeout(started.error)) {
    throw new Error(`"supabase start" superó ${START_TIMEOUT_MS / 60_000} min y se detuvo.`);
  }
  if (started.error || started.status !== 0) {
    const output = redact(`${started.stdout ?? ""}\n${started.stderr ?? ""}`).trim();
    throw new Error(`"supabase start" falló.\n${output.slice(-2000)}`);
  }

  if (!readStatus()) {
    throw new Error("Supabase arrancó pero no reporta estado válido con \"supabase status\".");
  }
}

// Variables de entorno para apuntar la app y las pruebas al stack LOCAL.
export async function getLocalSupabaseEnv() {
  const status = readStatusOrThrow();

  const url = status.API_URL;
  const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
  const dbUrl = status.DB_URL;

  if (!url || !anonKey || !serviceRoleKey || !dbUrl) {
    throw new Error("El estado de Supabase local no incluye API_URL, claves o DB_URL.");
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_DB_URL: dbUrl,
    GLOWBOOK_ENV: "local",
    GLOWBOOK_TEST_TARGET: "local",
  };
}
