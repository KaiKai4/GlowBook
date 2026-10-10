import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { readBoundedText } from "@/infra/http/bounded-body";
import { jsonNoStore, noContent } from "@/infra/http/responses";
import { CSP_REPORT_CONTENT_TYPES, parseCspReport } from "@/infra/security/csp-report";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";

// Recibe informes de violacion CSP (report-uri y report-to). Es publico por
// necesidad: el navegador envia el informe sin sesion. Por eso va limitado por
// IP, acotado en tamaño y sin registrar mas que un resumen minimo.

const MAX_REPORT_BYTES = 16 * 1024;
const REPORT_RATE_LIMIT = RATE_LIMIT_POLICIES.restricted;

export async function POST(request: Request) {
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(CSP_REPORT_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return jsonNoStore({ error: "Tipo de contenido no soportado." }, 415);
  }

  const limited = await assertAnonymousRateLimit("csp-report", REPORT_RATE_LIMIT);
  if (!limited.ok) return jsonNoStore({ error: limited.error }, 429);

  const text = await readBoundedText(request, MAX_REPORT_BYTES);
  if (text === null) return jsonNoStore({ error: "Informe demasiado grande." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonNoStore({ error: "JSON inválido." }, 400);
  }

  const violations = parseCspReport(contentType, body);
  if (!violations) return jsonNoStore({ error: "Informe inválido." }, 400);

  for (const violation of violations) {
    console.warn(JSON.stringify({ event: "csp_violation", ...violation }));
  }
  return noContent();
}
