// Helpers para formularios basados en FormData que envían con useSubmissionIntent.
// Los datos que se hashean nunca salen del navegador ni se guardan en el diario.

/** Pares [campo, valor] en el orden del formulario; los ficheros se reducen a su nombre. */
export function formDataEntries(source: FormData): Array<[string, string]> {
  return Array.from(source.entries(), ([name, value]): [string, string] => [
    name,
    typeof value === "string" ? value : value.name,
  ]);
}

/** Copia el FormData añadiendo la clave de idempotencia, sin duplicarla si ya existía. */
export function withIdempotencyKey(source: FormData, idempotencyKey: string): FormData {
  const next = new FormData();
  next.set("idempotency_key", idempotencyKey);
  source.forEach((value, name) => {
    if (name !== "idempotency_key") next.append(name, value);
  });
  return next;
}
