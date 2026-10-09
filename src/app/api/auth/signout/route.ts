import { jsonNoStore, redirectNoStore } from "@/lib/http/responses";
import { isSameOriginRequest, requestOrigin } from "@/lib/security/same-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
