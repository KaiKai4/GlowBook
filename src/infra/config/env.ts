import { z, ZodError } from "@/infra/validation/zod";

// Acceso perezoso a las variables de entorno. Sin valores por defecto: si falta
// una variable o es invalida, se lanza un Error que nombra la variable, nunca
// su valor. Cada funcion lee process.env al llamarse, no al importar el modulo.
//
// Cada acceso usa la expresion literal process.env.NOMBRE para que Next pueda
// incrustar las variables NEXT_PUBLIC_* en el bundle del cliente.

const publicSupabaseSchema = z.object({
  url: z.url(),
  anonKey: z.string().min(1),
});

const publicSupabaseNames: Readonly<Record<string, string>> = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
};

const serviceRoleSchema = z.string().min(1);

function invalidEnvError(error: ZodError, names: Readonly<Record<string, string>>): Error {
  const invalid = new Set(
    error.issues.map((issue) => names[String(issue.path[0] ?? "")] ?? "desconocida")
  );
  return new Error(`Variable de entorno ausente o inválida: ${[...invalid].join(", ")}.`);
}

/** URL y clave anonima publicas de Supabase. Lanza si falta alguna o la URL no es valida. */
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const parsed = publicSupabaseSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) throw invalidEnvError(parsed.error, publicSupabaseNames);
  return parsed.data;
}

/** Clave service_role de Supabase. Solo para servidor. Lanza si falta. */
export function getSupabaseServiceRoleKey(): string {
  const parsed = serviceRoleSchema.safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!parsed.success) {
    throw new Error("Variable de entorno ausente o inválida: SUPABASE_SERVICE_ROLE_KEY.");
  }
  return parsed.data;
}
