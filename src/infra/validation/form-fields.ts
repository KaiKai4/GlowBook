// Lectura de campos de formulario sin depender de FormData: cualquier origen con
// get/getAll (FormData, un mapa de pruebas) sirve. No decide reglas de negocio:
// solo convierte valores ausentes en texto, y los valores por defecto los fija
// quien llama.

export interface FormFieldSource {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}

/** Texto del campo; si falta (null o undefined) devuelve el valor por defecto. */
export function formText(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

/** Casilla marcada: el valor llega como "on" (checkbox) o "true". */
export function formFlag(value: unknown): boolean {
  return value === "on" || value === "true";
}
