import { z } from "@/infra/validation/zod";

// Email común a los formularios (alta de clientes y colaboradores, invitaciones).
// Mismo mensaje y mismo límite en todos los puntos de entrada.
export const emailSchema = z.string().email("Email inválido").max(255, "Email inválido");

// Campo opcional de formulario: la cadena vacía significa "sin email".
export const optionalEmailSchema = z.union([z.literal(""), emailSchema]);
