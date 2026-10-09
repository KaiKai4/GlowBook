import "server-only";
import { z } from "@/infra/validation/zod";

// Reglas de entrada de las acciones de autenticacion con contraseña. Los mensajes
// coinciden con los que muestra el formulario, para que la validacion del servidor
// no cambie lo que ve el usuario.

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_MIN_LENGTH_MESSAGE = "La contraseña debe tener al menos 8 caracteres.";

export const PasswordSchema = z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE);

export const SignInSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  remember: z.boolean(),
});

export type SignInInput = z.infer<typeof SignInSchema>;
