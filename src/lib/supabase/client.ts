"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { SESSION_ONLY_COOKIE } from "./session-persistence";

export function createSupabaseBrowserClient() {
  // Si el usuario desmarco "Recordarme", las cookies de auth se escriben sin
  // Max-Age (cookies de sesion): el navegador las borra al cerrarse.
  const sessionOnly =
    typeof document !== "undefined" &&
    document.cookie.split("; ").includes(`${SESSION_ONLY_COOKIE}=1`);

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    sessionOnly ? { cookieOptions: { maxAge: undefined, expires: undefined } } : undefined
  );
}
