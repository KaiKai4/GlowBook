import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { deleteSalon } from "@/features/platform/use-cases/delete-salon";
import { inviteSalon, regenerateSalonInvitation } from "@/features/platform/use-cases/invite-salon";
import { setFeedbackReportStatus } from "@/features/platform/use-cases/set-feedback-report-status";
import { updateSalonStatus } from "@/features/platform/use-cases/update-salon-status";
import { removeCommercialAddonConfig, saveCommercialAddonConfig } from "@/features/billing/use-cases/commercial-addons";
import {
  archivePlan,
  deletePlan,
  saveCommercialPlanConfig,
  saveCommercialPlanLimitsBatch,
  saveCommercialPlanModulesBatch,
} from "@/features/billing/use-cases/commercial-plans";
import {
  assignSalonAddonConfig,
  assignSalonCommercialPlanConfig,
  cancelSalonExtraConfig,
  registerSalonPlanPaymentConfig,
  resolveSalonPlanAlertConfig,
  saveSalonManualExtraConfig,
} from "@/features/billing/use-cases/salon-subscriptions";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { PLATFORM_PLAN_IDLE_STATE } from "./plans/action-state";
import { archivePlanAction, deletePlanAction, removeAddonAction, saveAddonAction, savePlanAction, savePlanLimitsAction, savePlanModulesAction } from "./plans/actions";
import { setFeedbackStatusAction } from "./reports/actions";
import {
  assignPlanAction,
  cancelExtraAction,
  giveAddonAction,
  giveManualExtraAction,
  registerPaymentAction,
  resolveAlertAction,
} from "./subscriptions/actions";
import {
  deleteSalonAction,
  inviteSalonAction,
  regenerateSalonInvitationAction,
  updateSalonStatusAction,
} from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/platform/use-cases/invite-salon", () => ({
  inviteSalon: vi.fn(),
  regenerateSalonInvitation: vi.fn(),
}));
vi.mock("@/features/platform/use-cases/delete-salon", () => ({ deleteSalon: vi.fn() }));
vi.mock("@/features/platform/use-cases/update-salon-status", () => ({ updateSalonStatus: vi.fn() }));
vi.mock("@/features/platform/use-cases/set-feedback-report-status", () => ({
  setFeedbackReportStatus: vi.fn(),
}));
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
vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({
  assignSalonAddonConfig: vi.fn(),
  assignSalonCommercialPlanConfig: vi.fn(),
  cancelSalonExtraConfig: vi.fn(),
  registerSalonPlanPaymentConfig: vi.fn(),
  resolveSalonPlanAlertConfig: vi.fn(),
  saveSalonManualExtraConfig: vi.fn(),
}));

const ID = "00000000-0000-4000-8000-0000000000a1";

const USE_CASES = [
  inviteSalon,
  regenerateSalonInvitation,
  deleteSalon,
  updateSalonStatus,
  setFeedbackReportStatus,
  saveCommercialPlanConfig,
  archivePlan,
  deletePlan,
  saveCommercialPlanModulesBatch,
  saveCommercialPlanLimitsBatch,
  saveCommercialAddonConfig,
  removeCommercialAddonConfig,
  assignSalonCommercialPlanConfig,
  assignSalonAddonConfig,
  saveSalonManualExtraConfig,
  registerSalonPlanPaymentConfig,
  resolveSalonPlanAlertConfig,
  cancelSalonExtraConfig,
];

const ACTIONS: Array<[string, () => Promise<unknown>]> = [
  ["inviteSalonAction", () => inviteSalonAction(null, new FormData())],
  ["regenerateSalonInvitationAction", () => regenerateSalonInvitationAction(ID)],
  ["deleteSalonAction", () => deleteSalonAction(ID, "BORRAR")],
  ["updateSalonStatusAction", () => updateSalonStatusAction(ID, true)],
  ["setFeedbackStatusAction", () => setFeedbackStatusAction(new FormData())],
  ["savePlanAction", () => savePlanAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["archivePlanAction", () => archivePlanAction(ID)],
  ["deletePlanAction", () => deletePlanAction(ID)],
  ["savePlanModulesAction", () => savePlanModulesAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["savePlanLimitsAction", () => savePlanLimitsAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["saveAddonAction", () => saveAddonAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["removeAddonAction", () => removeAddonAction(ID)],
  ["assignPlanAction", () => assignPlanAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["giveAddonAction", () => giveAddonAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["giveManualExtraAction", () => giveManualExtraAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["registerPaymentAction", () => registerPaymentAction(PLATFORM_PLAN_IDLE_STATE, new FormData())],
  ["resolveAlertAction", () => resolveAlertAction(ID, ID)],
  ["cancelExtraAction", () => cancelExtraAction(ID, ID)],
];

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
  vi.mocked(requirePlatformAdmin).mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
});

describe("acciones de plataforma: guarda de platform admin", () => {
  it.each(ACTIONS)("%s redirige sin limitar ni llamar a ningun caso de uso", async (_name, call) => {
    await expect(call()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    for (const useCase of USE_CASES) expect(useCase).not.toHaveBeenCalled();
  });
});
