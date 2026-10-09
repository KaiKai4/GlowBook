import { jsonNoStore, redirectNoStore } from "@/infra/http/responses";
import { signOutCurrentSession } from "@/infra/auth/password-auth";
import { isSameOriginRequest, requestOrigin } from "@/infra/security/same-origin";

// Cierre de sesion desde formularios de la app. Solo acepta peticiones del
// mismo origen: evita que una pagina ajena cierre la sesion del usuario (CSRF).
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonNoStore({ error: "Origen no permitido." }, 403);
  }

  await signOutCurrentSession();
  return redirectNoStore(new URL("/login", requestOrigin(request)));
}
