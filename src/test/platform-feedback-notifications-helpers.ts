// Utilidades de aserción compartidas por los tests de platform, feedback y notifications.

/** Primer elemento de una lista; falla el test de forma explícita si la lista está vacía. */
export function firstOf<T>(items: readonly T[]): T {
  const [first] = items;
  if (first === undefined) throw new Error("Se esperaba al menos un elemento");
  return first;
}
