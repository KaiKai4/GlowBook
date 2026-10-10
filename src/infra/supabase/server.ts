import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/infra/config/env";
import type { Database } from "@/types/database.types";
import { SESSION_ONLY_COOKIE, setSupabaseServerCookies } from "./cookies";

// Sin cache(): la memoizacion por request vive en el composition root
// (src/app/_composition/request-context.ts), no en infraestructura.
export interface SupabaseServerClientOptions {
  /**
   * Fuerza la persistencia de las cookies de auth. Sin valor se lee el marcador
   * "recordarme" de la peticion; el login lo pasa explicitamente porque el
   * marcador acaba de escribirse en esta misma accion.
   */
  sessionOnly?: boolean;
}

export async function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  const cookieStore = await cookies();
  const sessionOnly = options.sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";
  const { url, anonKey } = getSupabasePublicEnv();
  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          setSupabaseServerCookies(cookieStore, cookiesToSet, sessionOnly);
        },
      },
    }
  );
}
