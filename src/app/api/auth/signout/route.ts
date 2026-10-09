import { jsonNoStore, redirectNoStore } from "@/infra/http/responses";
import { isSameOriginRequest, requestOrigin } from "@/infra/security/same-origin";
import { createSupabaseServerClient } from "@/infra/supabase/server";

// Cierre de sesion desde formularios de la app. Solo acepta peticiones del
// mismo origen: evita que una pagina ajena cierre la sesion del usuario (CSRF).
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonNoStore({ error: "Origen no permitido." }, 403);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return redirectNoStore(new URL("/login", requestOrigin(request)));
}
