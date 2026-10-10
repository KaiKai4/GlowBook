// Runner propio de pruebas pgTAP sobre la BD de Supabase LOCAL (paso "db-tests" y "npm run db:test").
//
// MOTIVO: el CLI de Supabase 2.120.0 se cuelga indefinidamente en Windows con Docker Desktop 29.x
// tras imprimir "Connecting to local database...", justo al lanzar el contenedor de pg_prove.
// Además, en esta máquina los montajes bind (-v) de Docker Desktop tampoco devuelven nunca
// (ni con rutas con espacios ni sin ellos), así que los tests se copian al contenedor con
// `docker cp` antes de arrancarlo. Este script replica lo que hace `supabase test db`:
//   1) instala la extensión pgtap en la BD del stack local;
//   2) crea un contenedor pg_prove en la red del stack, copia supabase/tests dentro y lo ejecuta.
// Funciona igual en local (Windows) y en CI (Linux): solo usa `docker` con argumentos separados
// (sin shell). Nunca toca staging ni producción: las credenciales son las del stack local
// (no son secretos).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readProjectId } from "./supabase-env.mjs";

export { readProjectId };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// Misma versión de pg_prove que usa supabase CLI 2.120.0 para `supabase test db`.
const PG_PROVE_IMAGE = "public.ecr.aws/supabase/pg_prove:3.36";
// Límite por comando de Docker: nunca se espera indefinidamente.
const COMMAND_TIMEOUT_MS = 8 * 60_000;
// Ruta de los tests dentro del contenedor.
const CONTAINER_TESTS_DIR = "/tests";
// Credenciales del stack local (mismas que usa el CLI de Supabase).
const LOCAL_DB_USER = "postgres";
const LOCAL_DB_PASSWORD = "postgres";
const LOCAL_DB_NAME = "postgres";
const LOCAL_DB_PORT = "5432";

/**
 * Argumentos de `docker create` para el contenedor pg_prove dentro de la red del stack local.
 * El contenedor se arranca después con `docker start -a` (tras copiar los tests).
 * @param {{ projectId: string, image: string }} options
 * @returns {string[]}
 */
export function buildPgProveArgs({ projectId, image }) {
  const dbHost = `supabase_db_${projectId}`;
  return [
    "create",
    "--network", `supabase_network_${projectId}`,
    "-e", `PGHOST=${dbHost}`,
    "-e", `PGPORT=${LOCAL_DB_PORT}`,
    "-e", `PGUSER=${LOCAL_DB_USER}`,
    "-e", `PGPASSWORD=${LOCAL_DB_PASSWORD}`,
    "-e", `PGDATABASE=${LOCAL_DB_NAME}`,
    image,
    "pg_prove", "--ext", ".pg", "--ext", ".sql", "-r", CONTAINER_TESTS_DIR,
  ];
}

/**
 * Ejecuta docker con argumentos separados (sin shell). Devuelve el resultado de spawnSync;
 * lanza si docker no arranca o expira el timeout.
 * @param {string[]} args
 * @param {string} label descripción para los mensajes de error
 * @param {"inherit" | "pipe"} stdout
 * @returns {{ status: number, stdout: string }}
 */
function runDocker(args, label, stdout = "inherit") {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", stdout, "inherit"],
    shell: false,
    windowsHide: true,
    timeout: COMMAND_TIMEOUT_MS,
  });
  if (result.error) {
    const code = /** @type {NodeJS.ErrnoException} */ (result.error).code;
    if (code === "ETIMEDOUT") {
      throw new Error(`${label} superó ${COMMAND_TIMEOUT_MS / 60_000} min y se detuvo.`);
    }
    throw new Error(`${label} no pudo ejecutarse: ${result.error.message}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

/**
 * Ejecuta pg_prove: crea el contenedor, copia los tests, lo arranca y lo elimina al terminar.
 * @param {string} projectId
 * @param {string} testsDir
 * @returns {number} código de salida de pg_prove
 */
function runProve(projectId, testsDir) {
  const created = runDocker(buildPgProveArgs({ projectId, image: PG_PROVE_IMAGE }), "docker create", "pipe");
  const containerId = created.stdout.trim();
  if (created.status !== 0 || containerId === "") {
    throw new Error("docker create no devolvió un contenedor para pg_prove.");
  }
  try {
    const copied = runDocker(["cp", `${testsDir}/.`, `${containerId}:${CONTAINER_TESTS_DIR}`], "docker cp");
    if (copied.status !== 0) throw new Error(`docker cp de los tests falló (código ${copied.status}).`);
    return runDocker(["start", "-a", containerId], "pg_prove").status;
  } finally {
    runDocker(["rm", "-f", containerId], "docker rm", "pipe");
  }
}

/** @returns {number} código de salida de pg_prove (0 si todas las pruebas pasan) */
function main() {
  const projectId = readProjectId(readFileSync(path.join(ROOT, "supabase", "config.toml"), "utf8"));
  const testsDir = path.resolve(ROOT, "supabase", "tests");
  const dbContainer = `supabase_db_${projectId}`;

  const extension = runDocker([
    "exec", dbContainer,
    "psql", "-U", LOCAL_DB_USER, "-d", LOCAL_DB_NAME,
    "-v", "ON_ERROR_STOP=1",
    "-c", "create extension if not exists pgtap with schema extensions",
  ], "Instalar pgtap");
  if (extension.status !== 0) {
    console.error(`No se pudo instalar pgtap en ${dbContainer} (código ${extension.status}). ¿Está el stack local arriba?`);
    return 1;
  }

  return runProve(projectId, testsDir);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`run-pgtap: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
