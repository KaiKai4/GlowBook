import type { z } from "@/infra/validation/zod";

// Valida el valor de un control (`event.target.value`) contra un esquema Zod de
// opciones. Sustituye al cast `value as X`: si el valor no pertenece a las opciones,
// devuelve el `fallback` (o `undefined` si no se indicó).
export function parseOption<T>(schema: z.ZodType<T>, value: string, fallback: T): T;
export function parseOption<T>(schema: z.ZodType<T>, value: string): T | undefined;
export function parseOption<T>(schema: z.ZodType<T>, value: string, fallback?: T): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}
