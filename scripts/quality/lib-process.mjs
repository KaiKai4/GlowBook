// Ejecución multiplataforma de comandos para el runner de calidad.
// Los binarios locales viven en node_modules/.bin; en Windows son .cmd y
// requieren shell, así que se lanzan con una cadena citada en lugar de argv.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const IS_WINDOWS = process.platform === "win32";

/**
 * Cita un token para una línea de comandos de shell de Windows. Sigue las reglas
 * de CommandLineToArgvW: las barras invertidas solo son especiales antes de una
 * comilla (o del cierre), y ahí se duplican para que lleguen literales.
 * @param {string} token
 * @returns {string}
 */
export function quoteForShell(token) {
  if (token === "") return '""';
  if (!/[\s"&|<>^()]/.test(token)) return token;
  const escaped = token.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
  return `"${escaped}"`;
}

/**
 * Resuelve un argv (["eslint", "--max-warnings", "0"]) a un ejecutable real.
 * - "node" usa el mismo binario de Node que ejecuta el script.
 * - Un nombre con binario en node_modules/.bin se usa directamente.
 * - En Windows, los .cmd se ejecutan con shell (cadena citada).
 */
/** @param {string[]} argv @returns {{ file: string, args: string[], shell: boolean }} */
function resolveCommand(argv) {
  const [name, ...args] = argv;
  if (name === "node") {
    return { file: process.execPath, args, shell: false };
  }

  const localBase = join(ROOT, "node_modules", ".bin", name);
  if (IS_WINDOWS && existsSync(`${localBase}.cmd`)) {
    return { file: `${localBase}.cmd`, args, shell: true };
  }
  if (!IS_WINDOWS && existsSync(localBase)) {
    return { file: localBase, args, shell: false };
  }
  // Comando del sistema (npm, npx, ...). En Windows npm es npm.cmd.
  return { file: name, args, shell: IS_WINDOWS };
}

/** @param {{ file: string, args: string[] }} resolved @returns {string} */
function buildShellCommand({ file, args }) {
  return [file, ...args].map(quoteForShell).join(" ");
}

/**
 * Ejecuta argv de forma síncrona. Con `capture: true` devuelve stdout/stderr;
 * si no, hereda la salida del proceso padre.
 * @param {string[]} argv
 * @param {{ env?: NodeJS.ProcessEnv, cwd?: string, capture?: boolean }} [runOptions]
 * @returns {{ status: number, signal: NodeJS.Signals | null, error: Error | null, stdout: string, stderr: string }}
 */
export function runArgv(argv, { env = process.env, cwd = ROOT, capture = false } = {}) {
  const resolved = resolveCommand(argv);
  /** @type {import("node:child_process").SpawnSyncOptionsWithStringEncoding} */
  const options = {
    cwd,
    env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  };

  const result = resolved.shell
    ? spawnSync(buildShellCommand(resolved), { ...options, shell: true })
    : spawnSync(resolved.file, resolved.args, { ...options, shell: false });

  return {
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error ?? null,
    stdout: capture ? (result.stdout ?? "") : "",
    stderr: capture ? (result.stderr ?? "") : "",
  };
}

/**
 * Argumentos de taskkill para terminar un árbol de procesos en Windows.
 * Sin /T solo muere el proceso directo (cmd.exe de un .cmd) y sus hijos quedan vivos.
 * @param {number} pid
 * @returns {string[]}
 */
export function taskkillArgs(pid) {
  return ["/PID", String(pid), "/T", "/F"];
}

/**
 * Termina un proceso y todos sus descendientes.
 * En POSIX el proceso se lanza con detached, así que -pid apunta a su grupo.
 * @param {number | undefined} pid
 * @returns {boolean} true si la orden de terminación se ejecutó sin error
 */
export function killProcessTree(pid) {
  if (pid === undefined || !Number.isInteger(pid) || pid <= 0) return false;
  if (IS_WINDOWS) {
    const result = spawnSync("taskkill", taskkillArgs(pid), { stdio: "ignore", windowsHide: true });
    return result.status === 0;
  }
  try {
    process.kill(-pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

/**
 * Clasifica el resultado de un proceso ejecutado con límite de tiempo.
 * @param {{ timedOut: boolean, status: number | null, error: Error | null }} result
 * @returns {"ok" | "fail" | "timeout"}
 */
export function classifyRunResult({ timedOut, status, error }) {
  if (timedOut) return "timeout";
  if (error || status !== 0) return "fail";
  return "ok";
}

/**
 * Ejecuta argv de forma asíncrona con salida heredada y límite de tiempo.
 * Si el plazo expira, termina el árbol de procesos y resuelve con timedOut: true
 * sin esperar a que el proceso cierre.
 * @param {string[]} argv
 * @param {{ env?: NodeJS.ProcessEnv, cwd?: string, timeoutMs: number }} options
 * @returns {Promise<{ status: number | null, timedOut: boolean, error: Error | null }>}
 */
export function runArgvWithTimeout(argv, { env = process.env, cwd = ROOT, timeoutMs }) {
  const resolved = resolveCommand(argv);
  const command = resolved.shell ? buildShellCommand(resolved) : resolved.file;
  const args = resolved.shell ? [] : resolved.args;

  return new Promise((resolve) => {
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    let settled = false;
    /** @param {{ status: number | null, timedOut: boolean, error: Error | null }} value */
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    const child = spawn(command, args, {
      cwd,
      env,
      shell: resolved.shell,
      stdio: "inherit",
      windowsHide: true,
      detached: !IS_WINDOWS,
    });
    timer = setTimeout(() => {
      killProcessTree(child.pid);
      finish({ status: null, timedOut: true, error: null });
    }, timeoutMs);
    child.on("error", (error) => finish({ status: null, timedOut: false, error }));
    child.on("close", (code) => finish({ status: code, timedOut: false, error: null }));
  });
}
