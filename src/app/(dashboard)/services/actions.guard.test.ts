import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { archiveServiceCategory } from "@/features/services/use-cases/archive-category";
import { createCatalogService } from "@/features/services/use-cases/create-service";
import { updateCatalogService } from "@/features/services/use-cases/update-service";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID } from "@/test/action-fixtures";
import { archiveCategoryAction, createServiceAction, updateServiceAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/services/use-cases/create-service", () => ({ createCatalogService: vi.fn() }));
vi.mock("@/features/services/use-cases/update-service", () => ({ updateCatalogService: vi.fn() }));
vi.mock("@/features/services/use-cases/archive-category", () => ({ archiveServiceCategory: vi.fn() }));

const manager = buildProfile({ permissions: [PERMISSIONS.SERVICES_MANAGE] });
const RATE_LIMITED = { ok: false, error: "Demasiados intentos." } as const;
const validService = {
  category_id: RECORD_ID,
  name: "Corte",
  duration_hours: "1",
  duration_minutes_part: "0",
  price: "150",
};

describe("services actions: límite de peticiones y éxito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(archiveServiceCategory).mockResolvedValue(ok(undefined));
  });

  it("aplica el ámbito services con 60 peticiones por minuto por perfil", async () => {
    await archiveCategoryAction(RECORD_ID);

    expect(assertActionRateLimit).toHaveBeenCalledWith(manager.id, "services", {
      max: 60,
      windowMs: 60_000,
    });
  });

  it("devuelve el bloqueo del límite sin consultar el plan ni crear el servicio", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await createServiceAction(null, formDataOf(validService))).toEqual(RATE_LIMITED);
    expect(checkPlanModuleAccess).not.toHaveBeenCalled();
    expect(checkPlanLimit).not.toHaveBeenCalled();
    expect(createCatalogService).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("bloquea la actualización de servicio por límite sin persistir", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await updateServiceAction(RECORD_ID, null, formDataOf({ name: "Corte" }))).toEqual(RATE_LIMITED);
    expect(updateCatalogService).not.toHaveBeenCalled();
  });

  it("no revalida la actualización de servicio cuando el caso de uso falla", async () => {
    vi.mocked(updateCatalogService).mockResolvedValue(err("Error al actualizar el servicio."));

    expect(
      await updateServiceAction(RECORD_ID, null, formDataOf({ name: "Corte", duration_hours: "1" }))
    ).toEqual({ ok: false, error: "Error al actualizar el servicio." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("crea el servicio y revalida /services cuando todo es correcto", async () => {
    vi.mocked(createCatalogService).mockResolvedValue(ok("svc-9"));

    expect(await createServiceAction(null, formDataOf(validService))).toEqual({ ok: true, value: "svc-9" });
    expect(revalidatePath).toHaveBeenCalledWith("/services");
  });
});
