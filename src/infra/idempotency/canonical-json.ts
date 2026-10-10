/**
 * Serializacion canonica para payloads de idempotencia.
 *
 * - Claves de objeto ordenadas con Array.prototype.sort() (unidades UTF-16), sin
 *   propiedades undefined.
 * - Solo objetos planos (prototipo Object.prototype o null). Date, Map, Set e
 *   instancias de clase se rechazan: serializarlos como {} haria colisionar payloads distintos.
 * - Numeros finitos normalizados: -0 pasa a 0 y el texto es el de su valor
 *   (5 y 5.0 producen "5"), asi el mismo payload logico siempre da el mismo hash.
 * - Cualquier valor no serializable (NaN, Infinity, funciones, bigint...) se rechaza.
 */
export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

/** Devuelve el payload ya canonico (listo para enviar a una RPC). Lanza si no es serializable. */
export function toCanonicalPayload(value: unknown): CanonicalJsonValue {
  return normalize(value, "$");
}

function normalize(value: unknown, path: string): CanonicalJsonValue {
  if (value === null) return null;

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`Número no finito en el payload (${path}).`);
      }
      return value === 0 ? 0 : value;
    case "object":
      if (Array.isArray(value)) {
        return value.map((item, index) => normalize(item, `${path}[${index}]`));
      }
      if (!isPlainObject(value)) {
        throw new TypeError(`Objeto no plano en el payload (${path}).`);
      }
      return normalizeObject(value as Record<string, unknown>, path);
    default:
      throw new TypeError(`Tipo no serializable en el payload (${path}).`);
  }
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeObject(value: Record<string, unknown>, path: string): CanonicalJsonValue {
  const result: { [key: string]: CanonicalJsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) continue;
    result[key] = normalize(item, `${path}.${key}`);
  }
  return result;
}
