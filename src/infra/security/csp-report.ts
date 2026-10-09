import { z } from "@/infra/validation/zod";

// Parseo de informes de violacion CSP. Acepta los dos formatos que emiten los
// navegadores: application/csp-report (report-uri, formato legacy) y
// application/reports+json (Reporting API, report-to). Solo se conserva lo
// minimo para diagnosticar: directiva, origen bloqueado y ruta del documento.
// Nunca se guardan query strings, fragmentos ni cuerpos de pagina.

export const CSP_REPORT_CONTENT_TYPES = ["application/csp-report", "application/reports+json"] as const;

const legacyReportSchema = z.object({
  "csp-report": z.object({
    "document-uri": z.string().max(2048).optional(),
    "effective-directive": z.string().max(128).optional(),
    "violated-directive": z.string().max(128).optional(),
    "blocked-uri": z.string().max(2048).optional(),
  }),
});

const reportingApiSchema = z.array(
  z.object({
    type: z.string().max(128),
    body: z
      .object({
        documentURL: z.string().max(2048).optional(),
        effectiveDirective: z.string().max(128).optional(),
        blockedURL: z.string().max(2048).optional(),
      })
      .optional(),
  })
);

export interface CspViolationSummary {
  directive: string;
  blockedOrigin: string;
  documentPath: string;
}

function safeOrigin(value: string | undefined): string {
  if (!value) return "none";
  // Valores especiales del navegador ("inline", "eval", "self") no son URLs.
  if (!value.includes(":")) return value.slice(0, 64);
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

function safePath(value: string | undefined): string {
  if (!value) return "none";
  try {
    return new URL(value).pathname;
  } catch {
    return "invalid";
  }
}

function summarize(
  directive: string | undefined,
  blocked: string | undefined,
  document: string | undefined
): CspViolationSummary {
  return {
    directive: directive ?? "unknown",
    blockedOrigin: safeOrigin(blocked),
    documentPath: safePath(document),
  };
}

/** Devuelve los resumenes de violaciones, o null si el cuerpo no es valido. */
export function parseCspReport(
  contentType: string,
  body: unknown
): CspViolationSummary[] | null {
  if (contentType === "application/csp-report") {
    const parsed = legacyReportSchema.safeParse(body);
    if (!parsed.success) return null;
    const report = parsed.data["csp-report"];
    return [
      summarize(
        report["effective-directive"] ?? report["violated-directive"],
        report["blocked-uri"],
        report["document-uri"]
      ),
    ];
  }

  if (contentType === "application/reports+json") {
    const parsed = reportingApiSchema.safeParse(body);
    if (!parsed.success) return null;
    return parsed.data
      .filter((report) => report.type === "csp-violation")
      .map((report) =>
        summarize(report.body?.effectiveDirective, report.body?.blockedURL, report.body?.documentURL)
      );
  }

  return null;
}
