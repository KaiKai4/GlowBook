import { beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { getProfile } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { captureError } from "@/lib/observability";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { getReportExportData } from "@/features/reports/use-cases/get-report-export";
import { buildProfile, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { GET } from "./route";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getProfile: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/reports/use-cases/get-report-export", () => ({
  getReportExportData: vi.fn(),
}));
vi.mock("./workbook", () => ({
  buildReportWorkbook: vi.fn(() => ({
    xlsx: { writeBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer },
  })),
}));

const EXPORT_URL = "https://app.glowbook.test/api/reports/export";
const RATE_LIMITED = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const reporter = buildProfile({ permissions: [PERMISSIONS.REPORTS_VIEW] });

function exportRequest(query = "") {
  return new Request(`${EXPORT_URL}${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers() as never);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  vi.mocked(getProfile).mockResolvedValue(reporter);
  vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
  vi.mocked(getReportExportData).mockResolvedValue({ rows: [] } as never);
});

describe("GET /api/reports/export: autorizacion", () => {
  it("sin sesion responde 401 sin cache", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "No autorizado." });
    expect(getReportExportData).not.toHaveBeenCalled();
  });

  it("con perfil inactivo responde 401", async () => {
    vi.mocked(getProfile).mockResolvedValue({ ...reporter, is_active: false });

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(getReportExportData).not.toHaveBeenCalled();
  });

  it("sin el permiso reports.view responde 403", async () => {
    vi.mocked(getProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.CUSTOMERS_MANAGE] }));

    const response = await GET(exportRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No tienes permiso para exportar reportes." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports/export: limite de peticiones", () => {
  it("limita por usuario con 5 por minuto y responde 429", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const response = await GET(exportRequest());

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: `user:${USER_ID}:reports-export`,
      p_max: 5,
      p_window_seconds: 60,
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: RATE_LIMITED });
    expect(getReportExportData).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports/export: parametros", () => {
  it("rechaza un mes mal formado con 400", async () => {
    const response = await GET(exportRequest("?month=2026-13"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Mes inválido." });
    expect(getReportExportData).not.toHaveBeenCalled();
  });

  it("rechaza un año mal formado con 400", async () => {
    const response = await GET(exportRequest("?year=26"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Año inválido." });
  });
});

describe("GET /api/reports/export: exportacion", () => {
  it("exporta un mes con los modulos efectivos y devuelve el xlsx como adjunto sin cache", async () => {
    const response = await GET(exportRequest("?month=2026-03"));

    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(reporter, "inventory");
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(reporter, "retail");
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(reporter, "expenses");
    expect(getReportExportData).toHaveBeenCalledWith(
      SALON_ID,
      { inventory: true, retail: true, expenses: true },
      { type: "month", monthKey: "2026-03" }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="glowbook-reportes-2026-03.xlsx"'
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
  });

  it("exporta un año completo cuando se pasa year", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockImplementation(
      async (_profile, module) => module === "retail"
    );

    const response = await GET(exportRequest("?year=2025"));

    expect(getReportExportData).toHaveBeenCalledWith(
      SALON_ID,
      { inventory: false, retail: true, expenses: false },
      { type: "year", year: 2025 }
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="glowbook-reportes-2025.xlsx"'
    );
  });

  it("sin parametros exporta el historico completo con fecha en el nombre", async () => {
    const response = await GET(exportRequest());

    expect(getReportExportData).toHaveBeenCalledWith(
      SALON_ID,
      expect.any(Object),
      { type: "lifetime" }
    );
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="glowbook-reportes-historico-\d{4}-\d{2}-\d{2}\.xlsx"$/
    );
  });

  it("si la generacion falla responde 500 sin filtrar el error y lo registra", async () => {
    const failure = new Error("relation reports_view does not exist");
    vi.mocked(getReportExportData).mockRejectedValue(failure);

    const response = await GET(exportRequest("?month=2026-03"));

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "No se pudo generar el archivo." });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "reports", action: "export" });
  });
});
