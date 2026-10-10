import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { archiveServiceCategory } from "@/features/services/use-cases/archive-category";
import { updateServiceCategory } from "@/features/services/use-cases/update-category";
import { updateCatalogService } from "@/features/services/use-cases/update-service";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  archiveCategoryAction,
  updateCategoryPricingModeAction,
  updateServiceAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/services/use-cases/archive-category", () => ({ archiveServiceCategory: vi.fn() }));
vi.mock("@/features/services/use-cases/create-category", () => ({ createServiceCategory: vi.fn() }));
vi.mock("@/features/services/use-cases/create-service", () => ({ createCatalogService: vi.fn() }));
vi.mock("@/features/services/use-cases/update-category", () => ({ updateServiceCategory: vi.fn() }));
vi.mock("@/features/services/use-cases/update-service", () => ({ updateCatalogService: vi.fn() }));

const INVALID = { ok: false, error: "Identificador inválido." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.SERVICES_MANAGE] });

describe("services actions: identificadores inválidos y revalidación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("updateCategoryPricingModeAction rechaza un categoryId inválido sin actualizar", async () => {
    expect(await updateCategoryPricingModeAction("cat-1", "variable")).toEqual(INVALID);
    expect(updateServiceCategory).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updateCategoryPricingModeAction actualiza el modo de precio y revalida servicios", async () => {
    vi.mocked(updateServiceCategory).mockResolvedValue(ok(undefined));

    expect(await updateCategoryPricingModeAction(RECORD_ID, "variable")).toEqual(ok(undefined));
    expect(updateServiceCategory).toHaveBeenCalledWith(
      RECORD_ID,
      SALON_ID,
      expect.objectContaining({ pricing_mode: "variable" })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/services");
  });

  it("archiveCategoryAction rechaza un categoryId inválido sin archivar", async () => {
    expect(await archiveCategoryAction("cat-1")).toEqual(INVALID);
    expect(archiveServiceCategory).not.toHaveBeenCalled();
  });

  it("archiveCategoryAction archiva la categoría y revalida servicios", async () => {
    vi.mocked(archiveServiceCategory).mockResolvedValue(ok(undefined));

    expect(await archiveCategoryAction(RECORD_ID)).toEqual(ok(undefined));
    expect(archiveServiceCategory).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/services");
  });

  it("updateServiceAction rechaza un serviceId inválido antes de leer la duración", async () => {
    expect(await updateServiceAction("srv-1", null, formDataOf({ name: "Corte" }))).toEqual(INVALID);
    expect(updateCatalogService).not.toHaveBeenCalled();
  });

  it("updateServiceAction actualiza el servicio con la duración combinada", async () => {
    vi.mocked(updateCatalogService).mockResolvedValue(ok(undefined));

    const form = formDataOf({ duration_hours: "1", duration_minutes_part: "30", name: "Corte" });
    expect(await updateServiceAction(RECORD_ID, null, form)).toEqual(ok(undefined));
    expect(updateCatalogService).toHaveBeenCalledWith(
      RECORD_ID,
      SALON_ID,
      expect.objectContaining({ duration_minutes: 90, name: "Corte" })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/services");
  });
});
