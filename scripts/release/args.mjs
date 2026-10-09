// Utilidades de argumentos de línea de comandos para los scripts de release.

/**
 * Valor de un argumento --name=valor, o null si no existe.
 * @param {readonly string[]} args
 * @param {string} name
 * @returns {string | null}
 */
export function getArgValue(args, name) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}
