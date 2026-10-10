import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/infra/config/env";
import type { Database } from "@/types/database.types";
import { SESSION_ONLY_COOKIE, sessionScopedOptions } from "./cookies";

export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";

  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, sessionScopedOptions(options, sessionOnly));
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getClaims();

  return {
    response,
    hasVerifiedSession: !error && Boolean(data?.claims.sub),
  };
}
