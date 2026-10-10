import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePlatformAdminProof } from "@/app/_composition/request-context";
import {
  archivePlan,
  deletePlan,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "@/features/billing/use-cases/commercial-plans";
import {
  removeCommercialAddonConfig,
  saveCommercialAddonConfig,
} from "@/features/billing/use-cases/commercial-addons";
import { err, ok } from "@/infra/result";
import { formDataOf } from "@/test/action-fixtures";
import {
  removeAddonAction,
  archivePlanAction,
  deletePlanAction,
  saveAddonAction,
  savePlanAction,
  savePlanLimitsAction,
  savePlanModulesAction,
} from "./actions";
import { PLATFORM_PLAN_IDLE_STATE } from "./action-state";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdminProof: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  archivePlan: vi.fn(),
  deletePlan: vi.fn(),
  saveCommercialPlanConfig: vi.fn(),
  saveCommercialPlanLimitsBatch: vi.fn(),
  saveCommercialPlanModulesBatch: vi.fn(),
}));
vi.mock("@/features/billing/use-cases/commercial-addons", () => ({
  removeCommercialAddonConfig: vi.fn(),
  saveCommercialAddonConfig: vi.fn(),
}));

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const ADMIN_PROOF = issuePlatformAdminProof(ADMIN_ID);
const PLAN_ID = "00000000-0000-4000-8000-0000000000b1";
const ADDON_ID = "00000000-0000-4000-8000-000000000a01";
const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const INVALID_ID = "Identificador inválido.";
const PLAN_PATHS = ["/admin/plans", "/admin/subscriptions", "/"];


beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdminProof).mockResolvedValue(issuePlatformAdminProof(ADMIN_ID));
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
});

describe("savePlanAction", () => {
  it("bloquea por rate limit y no guarda el plan", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const state = await savePlanAction(PLATFORM_PLAN_IDLE_STATE, formDataOf({ name: "Pro" }));

    expect(state).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(saveCommercialPlanConfig).not.toHaveBeenCalled();
  });

  it("normaliza el formulario: id vacio es undefined y el checkbox 'on' es verdadero", async () => {
    vi.mocked(saveCommercialPlanConfig).mockResolvedValue(ok(undefined) as never);

    const state = await savePlanAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ id: "", name: "Pro", code: "pro", isPublic: "on", status: "active" })
    );

    expect(saveCommercialPlanConfig).toHaveBeenCalledWith(ADMIN_PROOF, 
      {
        id: undefined,
        name: "Pro",
        code: "pro",
        description: "",
        monthlyPrice: "0",
        currency: "USD",
        trialDays: "0",
        status: "active",
        isPublic: true,
        sortOrder: "0",
      },
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Plan guardado." });
    for (const path of PLAN_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("pasa el id cuando se edita y marca isPublic falso sin 'on' o 'true'", async () => {
    vi.mocked(saveCommercialPlanConfig).mockResolvedValue(ok(undefined) as never);

    await savePlanAction(PLATFORM_PLAN_IDLE_STATE, formDataOf({ id: PLAN_ID, isPublic: "no" }));

    expect(saveCommercialPlanConfig).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ id: PLAN_ID, isPublic: false }),
      ADMIN_ID
    );
  });

  it("devuelve el mensaje del caso de uso y no revalida si falla", async () => {
    vi.mocked(saveCommercialPlanConfig).mockResolvedValue(err("El código ya existe.") as never);

    const state = await savePlanAction(PLATFORM_PLAN_IDLE_STATE, formDataOf({ code: "pro" }));

    expect(state).toEqual({ ok: false, message: "El código ya existe." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archivePlanAction", () => {
  it("lanza el mensaje del rate limit sin archivar", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    await expect(archivePlanAction(PLAN_ID)).rejects.toThrow(RATE_LIMIT_MESSAGE);
    expect(archivePlan).not.toHaveBeenCalled();
  });

  it("rechaza un id de plan que no es UUID", async () => {
    await expect(archivePlanAction("abc")).rejects.toThrow(INVALID_ID);
    expect(archivePlan).not.toHaveBeenCalled();
  });

  it("archiva el plan y revalida; lanza el error del caso de uso si falla", async () => {
    vi.mocked(archivePlan).mockResolvedValueOnce(ok(undefined) as never);

    await expect(archivePlanAction(PLAN_ID)).resolves.toBeUndefined();
    expect(archivePlan).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID, ADMIN_ID);
    for (const path of PLAN_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);

    vi.mocked(archivePlan).mockResolvedValueOnce(err("No se puede archivar.") as never);
    await expect(archivePlanAction(PLAN_ID)).rejects.toThrow("No se puede archivar.");
  });
});

describe("deletePlanAction", () => {
  it("lanza el mensaje del rate limit sin eliminar", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    await expect(deletePlanAction(PLAN_ID)).rejects.toThrow(RATE_LIMIT_MESSAGE);
    expect(deletePlan).not.toHaveBeenCalled();
  });

  it("rechaza un id de plan que no es UUID", async () => {
    await expect(deletePlanAction("abc")).rejects.toThrow(INVALID_ID);
    expect(deletePlan).not.toHaveBeenCalled();
  });

  it("elimina el plan solo a traves del caso de uso, que decide con el servidor", async () => {
    vi.mocked(deletePlan).mockResolvedValueOnce(ok(undefined) as never);

    await expect(deletePlanAction(PLAN_ID)).resolves.toBeUndefined();
    expect(deletePlan).toHaveBeenCalledWith(ADMIN_PROOF, PLAN_ID, ADMIN_ID);
    for (const path of PLAN_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);

    vi.mocked(deletePlan).mockResolvedValueOnce(err("El plan tiene salones asignados.") as never);
    await expect(deletePlanAction(PLAN_ID)).rejects.toThrow("El plan tiene salones asignados.");
  });
});

describe("savePlanModulesAction", () => {
  it("bloquea por rate limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const state = await savePlanModulesAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(saveCommercialPlanModulesBatch).not.toHaveBeenCalled();
  });

  it("envia todos los módulos y solo los activados", async () => {
    vi.mocked(saveCommercialPlanModulesBatch).mockResolvedValue(ok(undefined) as never);
    const formData = new FormData();
    formData.set("planId", PLAN_ID);
    formData.append("allModuleKeys", "inventory");
    formData.append("allModuleKeys", "retail");
    formData.append("enabledModuleKeys", "retail");

    const state = await savePlanModulesAction(PLATFORM_PLAN_IDLE_STATE, formData);

    expect(saveCommercialPlanModulesBatch).toHaveBeenCalledWith(ADMIN_PROOF, 
      { planId: PLAN_ID, allModuleKeys: ["inventory", "retail"], enabledModuleKeys: ["retail"] },
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Módulos del plan actualizados." });
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(saveCommercialPlanModulesBatch).mockResolvedValue(err("Plan no encontrado.") as never);

    const state = await savePlanModulesAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: "Plan no encontrado." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("savePlanLimitsAction", () => {
  it("bloquea por rate limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const state = await savePlanLimitsAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(saveCommercialPlanLimitsBatch).not.toHaveBeenCalled();
  });

  it("construye los límites por indice y aplica valores por defecto", async () => {
    vi.mocked(saveCommercialPlanLimitsBatch).mockResolvedValue(ok(undefined) as never);
    const formData = new FormData();
    formData.set("planId", PLAN_ID);
    formData.append("metricKey", "appointments");
    formData.append("metricKey", "employees");
    formData.append("maxValue", "100");
    formData.append("maxValue", "5");
    formData.append("enforcementMode", "block");
    formData.append("countScope", "monthly");
    formData.append("warningThreshold", "90");

    const state = await savePlanLimitsAction(PLATFORM_PLAN_IDLE_STATE, formData);

    expect(saveCommercialPlanLimitsBatch).toHaveBeenCalledWith(ADMIN_PROOF, 
      {
        planId: PLAN_ID,
        limits: [
          {
            metricKey: "appointments",
            maxValue: "100",
            enforcementMode: "block",
            warningThreshold: "90",
            countScope: "monthly",
          },
          {
            metricKey: "employees",
            maxValue: "5",
            enforcementMode: "warn",
            warningThreshold: "80",
            countScope: "current",
          },
        ],
      },
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Límites del plan actualizados." });
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(saveCommercialPlanLimitsBatch).mockResolvedValue(err("Límite inválido.") as never);

    const state = await savePlanLimitsAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: "Límite inválido." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveAddonAction", () => {
  it("bloquea por rate limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const state = await saveAddonAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(saveCommercialAddonConfig).not.toHaveBeenCalled();
  });

  it("guarda el extra con id, módulo y metrica opcionales vacios como undefined", async () => {
    vi.mocked(saveCommercialAddonConfig).mockResolvedValue(ok(undefined) as never);

    const state = await saveAddonAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ name: "Turbo", code: "turbo", limitDelta: "10", kind: "limit_boost" })
    );

    expect(saveCommercialAddonConfig).toHaveBeenCalledWith(ADMIN_PROOF, 
      {
        id: undefined,
        name: "Turbo",
        code: "turbo",
        description: "",
        kind: "limit_boost",
        moduleKey: undefined,
        metricKey: undefined,
        limitDelta: "10",
        currency: "USD",
        monthlyPrice: "0",
        status: "active",
        sortOrder: "0",
      },
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Extra guardado." });
    for (const path of PLAN_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(saveCommercialAddonConfig).mockResolvedValue(err("Código duplicado.") as never);

    const state = await saveAddonAction(PLATFORM_PLAN_IDLE_STATE, formDataOf({ code: "x" }));

    expect(state).toEqual({ ok: false, message: "Código duplicado." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removeAddonAction", () => {
  it("bloquea por rate limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    await expect(removeAddonAction(ADDON_ID)).rejects.toThrow(RATE_LIMIT_MESSAGE);
    expect(removeCommercialAddonConfig).not.toHaveBeenCalled();
  });

  it("rechaza un id que no es UUID", async () => {
    await expect(removeAddonAction("extra-1")).rejects.toThrow(INVALID_ID);
    expect(removeCommercialAddonConfig).not.toHaveBeenCalled();
  });

  it("elimina el extra y revalida; lanza el error del caso de uso si falla", async () => {
    vi.mocked(removeCommercialAddonConfig).mockResolvedValueOnce(ok(undefined) as never);

    await expect(removeAddonAction(ADDON_ID)).resolves.toBeUndefined();
    expect(removeCommercialAddonConfig).toHaveBeenCalledWith(ADMIN_PROOF, ADDON_ID, ADMIN_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/plans");

    vi.mocked(removeCommercialAddonConfig).mockResolvedValueOnce(err("Extra en uso.") as never);
    await expect(removeAddonAction(ADDON_ID)).rejects.toThrow("Extra en uso.");
  });
});
