import { NextResponse, type NextRequest } from "next/server";
import {
  getOptimisticAuthDecision,
  hasSupabaseSessionCookie,
} from "./proxy-auth";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
  REPORTING_ENDPOINTS_HEADER,
} from "@/lib/security/csp";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability/request-id";
import { requestOrigin } from "@/lib/security/same-origin";

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

  // Request id: se reutiliza el UUID entrante o se genera uno. Se inyecta en la
  // REQUEST (para que lo lean las rutas y captureError) y en TODAS las respuestas.
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  request.headers.set(REQUEST_ID_HEADER, requestId);

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
    // El origen real (Host / x-forwarded-host) evita redirigir a localhost detrás de un proxy.
    const redirectResponse = NextResponse.redirect(
      new URL(decision.location, requestOrigin(request))
    );
    copySessionMetadata(response, redirectResponse);
    // Una redirección de sesión no debe quedar en caché compartida (se fija tras copiar cabeceras).
    redirectResponse.headers.set("Cache-Control", "no-store");
    return applySecurityHeaders(redirectResponse, csp, requestId);
  }

  return applySecurityHeaders(response, csp, requestId);
}

// Cabeceras comunes a toda respuesta, incluidas las redirecciones.
function applySecurityHeaders(response: NextResponse, csp: string, requestId: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Reporting-Endpoints", REPORTING_ENDPOINTS_HEADER);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
