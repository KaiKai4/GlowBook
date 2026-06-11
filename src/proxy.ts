import { NextResponse, type NextRequest } from "next/server";
import {
  getOptimisticAuthDecision,
  hasSupabaseSessionCookie,
} from "./proxy-auth";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";
import { buildContentSecurityPolicy, generateCspNonce } from "@/lib/security/csp";

function copySessionMetadata(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
  source.headers.forEach((value, name) => {
    if (name !== "set-cookie") {
      target.headers.set(name, value);
    }
  });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestCookies = request.cookies.getAll();

  // CSP con nonce por request: se inyecta en los headers de la REQUEST antes
  // de construir cualquier respuesta, porque Next extrae el nonce del header
  // Content-Security-Policy entrante para firmar sus propios scripts.
  const nonce = generateCspNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);

  let response = NextResponse.next({ request });
  let hasVerifiedSession: boolean | undefined;

  if (hasSupabaseSessionCookie(requestCookies)) {
    const refreshedSession = await refreshSupabaseSession(request);
    response = refreshedSession.response;
    hasVerifiedSession = refreshedSession.hasVerifiedSession;
  }

  const decision = getOptimisticAuthDecision({
    pathname,
    cookies: requestCookies,
    hasVerifiedSession,
  });

  if (decision.type === "redirect") {
    const redirectResponse = NextResponse.redirect(
      new URL(decision.location, request.url)
    );
    copySessionMetadata(response, redirectResponse);
    return redirectResponse;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
