// Normalización de URLs de Supabase para comparar destinos (p. ej. staging frente a producción).

/**
 * Quita las barras finales y pasa a minúsculas, para que dos URLs equivalentes compare igual.
 * Un valor ausente se trata como cadena vacía.
 * @param {string | undefined} [value]
 * @returns {string}
 */
export function normalizeUrl(value = "") {
  return value.replace(/\/+$/, "").toLowerCase();
}
