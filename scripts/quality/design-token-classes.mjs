// Lectura de clases Tailwind dentro de fuentes .ts/.tsx para el trinquete de tokens.
// Lo usa check-design-tokens.mjs; separado para mantener cada script bajo el límite de líneas.

// Atributo className con valor entre comillas o entre llaves (aproximación: no lee template literals anidadas).
export const CLASS_NAME_ATTRIBUTE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
// Token de clase corrupto: variantes opcionales (hover:, md:...) seguidas de undefined/null/NaN.
const INVALID_CLASS_TOKEN = /^(?:[\w-]+:)*(?:undefined|null|NaN)/;
// Llamadas que reciben clases: cn(...), cva(...), clsx(...).
const CLASS_CALL_START = /\b(?:cn|cva|clsx)\(/g;
// Literales de cadena con comillas simples, dobles o plantilla (sin interpolación anidada).
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;

/**
 * Argumentos crudos de cada llamada cn(...), cva(...) o clsx(...), con paréntesis anidados.
 * @param {string} content
 * @returns {string[]}
 */
function classCallArguments(content) {
  const segments = [];
  for (const match of content.matchAll(CLASS_CALL_START)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (index < content.length && depth > 0) {
      if (content[index] === "(") depth += 1;
      if (content[index] === ")") depth -= 1;
      index += 1;
    }
    segments.push(content.slice(start, index - 1));
  }
  return segments;
}

/**
 * Cuenta tokens corruptos separados por espacios en una cadena de clases.
 * @param {string} classString
 * @returns {number}
 */
function countInvalidClassString(classString) {
  return classString.split(/\s+/).filter((token) => INVALID_CLASS_TOKEN.test(token)).length;
}

/**
 * Cuenta tokens corruptos en los literales de cadena de los argumentos de una llamada.
 * @param {string} fragment
 * @returns {number}
 */
function countInvalidInCallArguments(fragment) {
  let total = 0;
  for (const literal of fragment.matchAll(STRING_LITERAL)) {
    total += countInvalidClassString(literal[1] ?? literal[2] ?? literal[3] ?? "");
  }
  return total;
}

/**
 * Clases corruptas en className="..." y en argumentos de cn(), cva() y clsx().
 * Los className={...} se leen a través de sus llamadas para no contar dos veces.
 * @param {string} content
 * @returns {number}
 */
export function countInvalidClassTokens(content) {
  let total = 0;
  for (const match of content.matchAll(CLASS_NAME_ATTRIBUTE)) {
    const literalValue = match[1] ?? match[2];
    if (literalValue !== undefined) {
      total += countInvalidClassString(literalValue);
    }
  }
  for (const segment of classCallArguments(content)) {
    total += countInvalidInCallArguments(segment);
  }
  return total;
}
