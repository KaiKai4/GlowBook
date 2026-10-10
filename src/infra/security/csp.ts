// Content-Security-Policy en modo enforce, con nonce por request.
// Los scripts solo corren si llevan el nonce ('strict-dynamic' permite los
// chunks que Next encadena desde un script ya confiable). Los elementos <style>
// tambien exigen nonce ('nonce-...' en style-src, patron de la guia de Next en
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Los atributos style="..." que React escribe (graficas, alturas calculadas) no
// los cubre ningun nonce: se gobiernan con style-src-attr 'unsafe-inline'. Es la
// excepcion documentada en docs/security.md ("Excepcion CSP").

// Endpoint que recibe los informes de violacion (report-uri / report-to). Va
// en la cabecera Reporting-Endpoints y en la directiva report-uri.
export const CSP_REPORT_PATH = "/api/csp-report";
export const REPORTING_ENDPOINTS_HEADER = `csp-endpoint="${CSP_REPORT_PATH}"`;

function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "https://*.supabase.co";
  try {
    return new URL(url).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

/** Modo de ejecución: en desarrollo React necesita `unsafe-eval` y no se fuerza HTTPS. */
export type CspMode = "development" | "production";

export function buildContentSecurityPolicy({ nonce, mode }: { nonce: string; mode: CspMode }): string {
  const origin = supabaseOrigin();
  const isDev = mode === "development";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // En dev, Next/React Refresh puede inyectar <style> sin nonce: se tolera solo ahi.
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`,
    // Atributos style="..." (no cubiertos por nonce). Ver docs/security.md.
    "style-src-attr 'unsafe-inline'",
    // En dev React necesita eval para reconstruir stacks de error del server.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self' ${origin} https://*.supabase.co wss://*.supabase.co`,
    `report-uri ${CSP_REPORT_PATH}`,
    "report-to csp-endpoint",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
