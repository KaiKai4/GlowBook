import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import type {
  CommercialLimitMetric,
  EffectivePlanLimit,
  EffectiveSalonPlan,
} from "@/features/billing/domain/commercial-plan";
import { getEffectiveSalonPlan } from "@/features/billing";
import { plan } from "@/test/billing-plan-fixtures";
import { findDashboardShellSalon } from "../data/salon-settings.repo";
import { getDashboardShell, getOwnerPlanLimitWarnings } from "./get-dashboard-shell";

vi.mock("../data/salon-settings.repo", () => ({
  findDashboardShellSalon: vi.fn(),
}));

vi.mock("@/features/billing", async () => ({
  evaluatePaymentStanding: (await import("@/features/billing/domain/payment-standing")).evaluatePaymentStanding,
  isActionableLimitWarning: (await import("@/features/billing/domain/commercial-plan")).isActionableLimitWarning,
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  getEffectiveSalonPlan: vi.fn(),
  readEffectivePlanOrNull: async (salonId: string, _action: string, load: (id: string) => Promise<unknown>) => {
    try {
      return await load(salonId);
    } catch {
      return null;
    }
  },
}));

const mockedFindShellSalon = vi.mocked(findDashboardShellSalon);
const mockedEffectivePlan = vi.mocked(getEffectiveSalonPlan);

const TODAY = "2026-06-12T12:00:00.000Z";

const metric: CommercialLimitMetric = {
  key: "appointments_monthly",
  moduleKey: "appointments",
  name: "Citas",
  description: "Citas del mes",
  unit: "citas",
  counterKey: "appointments_total",
  defaultCountScope: "monthly",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};

function limit(overrides: Partial<EffectivePlanLimit>): EffectivePlanLimit {
  return {
    metric,
    maxValue: 100,
    enforcementMode: "block",
    warningThreshold: 80,
    countScope: "monthly",
    used: 10,
    remaining: 90,
    percentage: 10,
    warningLevel: "none",
    message: "",
    ...overrides,
  };
}

function effectivePlan(overrides: Partial<EffectiveSalonPlan>): EffectiveSalonPlan {
  return {
    salonId: "salon-1",
    plan: null,
    assignmentStatus: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    enabledModules: [],
    disabledModules: [],
    limits: [],
    usage: {},
    ...overrides,
  };
}

const ownerProfile: ProfileWithRole = {
  id: "profile-1",
  salon_id: "salon-1",
  role_id: null,
  is_owner: true,
  full_name: "Owner",
  is_active: true,
  salon: null,
  role: null,
};

const shellSalon = {
  name: "Glow Studio",
  is_active: true,
  theme: "tiffany",
  bg_style: "colored",
  disabled_features: ["reports"],
};

// El estado de pago sale del shell del dashboard (no tiene export propio).
async function paymentStanding() {
  return (await getDashboardShell(ownerProfile))?.paymentStanding;
}

describe("get-dashboard-shell (ramas de plan y estado de pago)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
    mockedFindShellSalon.mockResolvedValue(shellSalon);
    mockedEffectivePlan.mockResolvedValue(effectivePlan({}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDashboardShell", () => {
    it("usa los módulos deshabilitados del plan efectivo cuando el salón tiene plan asignado", async () => {
      mockedEffectivePlan.mockResolvedValue(
        effectivePlan({
          plan: plan(),
          disabledModules: ["retail"],
        })
      );

      const view = await getDashboardShell(ownerProfile);

      expect(view?.disabledFeatures).toEqual(["retail"]);
      // El owner conserva todos los permisos (cortocircuito); el plan solo decide módulos.
      expect(view?.permissions).toContain("reports.view");
    });

    it("usa las banderas del salón cuando no hay plan efectivo asignado", async () => {
      mockedEffectivePlan.mockResolvedValue(effectivePlan({ plan: null, disabledModules: ["retail"] }));

      const view = await getDashboardShell(ownerProfile);

      expect(view?.disabledFeatures).toEqual(["reports"]);
    });

    it("usa las banderas del salón cuando la consulta del plan falla", async () => {
      mockedEffectivePlan.mockRejectedValue(new Error("sin plan"));

      const view = await getDashboardShell(ownerProfile);

      expect(view?.disabledFeatures).toEqual(["reports"]);
      expect(view?.paymentStanding).toEqual({ state: "ok", overdueSince: null, graceDaysLeft: 0 });
    });

    it("entrega permisos del rol (no de propietario) segun las asignaciones del perfil", async () => {
      const staff: ProfileWithRole = {
        ...ownerProfile,
        is_owner: false,
        role_id: "role-1",
        role: {
          id: "role-1",
          name: "Recepcion",
          role_permissions: [
            { permission: { id: "p1", key: "appointments.view", description: "" } },
            { permission: { id: "p2", key: "clave.inexistente", description: "" } },
          ],
        },
      };
      mockedEffectivePlan.mockResolvedValue(effectivePlan({ plan: null }));
      mockedFindShellSalon.mockResolvedValue({ ...shellSalon, disabled_features: [] });

      const view = await getDashboardShell(staff);

      expect(view?.permissions).toEqual(["appointments.view"]);
      expect(view?.disabledFeatures).toEqual([]);
    });

    it("pasa el salón del perfil al repositorio y devuelve null si el salón no existe", async () => {
      mockedFindShellSalon.mockResolvedValue(null);

      expect(await getDashboardShell(ownerProfile)).toBeNull();
      expect(mockedFindShellSalon).toHaveBeenCalledWith("salon-1");
      expect(mockedEffectivePlan).not.toHaveBeenCalled();
    });

    it("refleja un salón inactivo sin ocultar su nombre", async () => {
      mockedFindShellSalon.mockResolvedValue({ ...shellSalon, is_active: false });

      expect(await getDashboardShell(ownerProfile)).toMatchObject({
        salonName: "Glow Studio",
        isActive: false,
      });
    });
  });

  describe("getSalonPaymentStanding", () => {
    it("esta al día cuando el período pagado no ha vencido", async () => {
      mockedEffectivePlan.mockResolvedValue(
        effectivePlan({ assignmentStatus: "active", currentPeriodEnd: "2026-07-01" })
      );

      expect(await paymentStanding()).toEqual({
        state: "ok",
        overdueSince: null,
        graceDaysLeft: 0,
      });
    });

    it("entra en período de gracia al vencer el período pagado", async () => {
      mockedEffectivePlan.mockResolvedValue(
        effectivePlan({ assignmentStatus: "active", currentPeriodEnd: "2026-06-10" })
      );

      expect(await paymentStanding()).toEqual({
        state: "grace",
        overdueSince: "2026-06-10",
        graceDaysLeft: 3,
      });
    });

    it("suspende el salón cuando agota la gracia del trial vencido", async () => {
      mockedEffectivePlan.mockResolvedValue(
        effectivePlan({ assignmentStatus: "trialing", trialEndsAt: "2026-06-01", currentPeriodEnd: "2026-12-31" })
      );

      expect(await paymentStanding()).toEqual({
        state: "suspended",
        overdueSince: "2026-06-01",
        graceDaysLeft: 0,
      });
    });

    it("no evalua mora cuando no hay plan efectivo", async () => {
      mockedEffectivePlan.mockRejectedValue(new Error("caida"));

      expect(await paymentStanding()).toEqual({
        state: "ok",
        overdueSince: null,
        graceDaysLeft: 0,
      });
    });
  });

  describe("getOwnerPlanLimitWarnings", () => {
    it("muestra solo avisos accionables y mapea el nivel cercano a 'warning' y el resto a 'danger'", async () => {
      mockedEffectivePlan.mockResolvedValue(
        effectivePlan({
          limits: [
            limit({ warningLevel: "near_limit", message: "Cerca del límite de citas" }),
            limit({ warningLevel: "over_limit", message: "Superaste el límite", used: 150, maxValue: 100 }),
            limit({ warningLevel: "none", message: "" }),
          ],
        })
      );

      expect(await getOwnerPlanLimitWarnings("salon-1")).toEqual([
        { level: "warning", message: "Cerca del límite de citas" },
        { level: "danger", message: "Superaste el límite" },
      ]);
    });

    it("omite avisos de capacidades al tope con alcance actual sin exceso", async () => {
      mockedEffectivePlan.mockResolvedValue(
        effectivePlan({
          limits: [
            limit({
              warningLevel: "blocked",
              message: "Al tope",
              countScope: "current",
              used: 5,
              maxValue: 5,
            }),
          ],
        })
      );

      expect(await getOwnerPlanLimitWarnings("salon-1")).toEqual([]);
    });

    it("devuelve lista vacia cuando no hay plan o la consulta falla", async () => {
      mockedEffectivePlan.mockResolvedValue(effectivePlan({ plan: null, limits: [] }));
      expect(await getOwnerPlanLimitWarnings("salon-1")).toEqual([]);

      mockedEffectivePlan.mockRejectedValue(new Error("caida"));
      expect(await getOwnerPlanLimitWarnings("salon-1")).toEqual([]);
    });
  });
});
