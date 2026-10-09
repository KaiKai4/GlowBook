import { createHash, randomBytes } from "crypto";

// Los tokens de invitacion viajan en el enlace y NUNCA se guardan en claro:
// la base solo conoce el sha256. Si la DB o un backup se filtra, los enlaces
// vigentes no sirven. El token en claro existe solo al generarse (se muestra
// una vez para copiar) y en la URL que recibe el invitado.
export interface InvitationToken {
  token: string;
  tokenHash: string;
}

export function hashInvitationToken(token: string): string {
  // Un token vacio no es un token: nunca debe convertirse en un hash buscable.
  if (token.length === 0) throw new Error("El token de invitación no puede estar vacío.");
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): InvitationToken {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashInvitationToken(token) };
}
