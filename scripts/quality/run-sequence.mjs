// Ejecuta varios comandos en secuencia separados por el token "--then".
// Se detiene en el primer fallo y devuelve su código de salida.
// Uso: node scripts/quality/run-sequence.mjs tsc --noEmit --then tsc -p scripts/tsconfig.json
import { runArgv } from "./lib-process.mjs";

const SEPARATOR = "--then";

/**
 * Separa la lista de argumentos en comandos por el token de separación.
 * @param {string[]} args
 * @returns {string[][]}
 */
function splitCommands(args) {
  /** @type {string[][]} */
  const commands = [[]];
  for (const token of args) {
    if (token === SEPARATOR) {
      commands.push([]);
    } else {
      commands[commands.length - 1].push(token);
    }
  }
  return commands.filter((command) => command.length > 0);
}

const commands = splitCommands(process.argv.slice(2));
if (commands.length === 0) {
  console.error("[run-sequence] Indica al menos un comando.");
  process.exit(2);
}

for (const argv of commands) {
  console.log(`\n> ${argv.join(" ")}`);
  const result = runArgv(argv);
  if (result.error) {
    console.error(`[run-sequence] No se pudo ejecutar "${argv[0]}": ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[run-sequence] "${argv[0]}" terminó con código ${result.status}.`);
    process.exit(result.status);
  }
}
