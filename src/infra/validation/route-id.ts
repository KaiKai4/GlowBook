import { z } from "@/infra/validation/zod";

// z.guid acepta cualquier UUID con forma 8-4-4-4-12 (incluidos los UUID de seed
// con version 0), a diferencia de z.uuid que exige version y variante RFC.
const GuidSchema = z.guid();

/**
 * Devuelve el valor si es un UUID bien formado, o null. Se usa antes de
 * cualquier consulta con IDs que llegan de la URL o de una accion.
 */
export function parseUuid(value: unknown): string | null {
  const parsed = GuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
