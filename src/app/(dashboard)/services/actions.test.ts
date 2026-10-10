import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { archiveServiceCategory } from "@/features/services/use-cases/archive-category";
import { createServiceCategory } from "@/features/services/use-cases/create-category";
import { createCatalogService } from "@/features/services/use-cases/create-service";
import { updateServiceCategory } from "@/features/services/use-cases/update-category";
import { updateCatalogService } from "@/features/services/use-cases/update-service";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  archiveCategoryAction,
  createCategoryAction,
  createServiceAction,
  updateCategoryPricingModeAction,
  updateServiceAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/services/use-cases/archive-category", () => ({ archiveServiceCategory: vi.fn() }));
vi.mock("@/features/services/use-cases/create-category", () => ({ createServiceCategory: vi.fn() }));
vi.mock("@/features/services/use-cases/create-service", () => ({ createCatalogService: vi.fn() }));
vi.mock("@/features/services/use-cases/update-category", () => ({ updateServiceCategory: vi.fn() }));
vi.mock("@/features/services/use-cases/update-service", () => ({ updateCatalogService: vi.fn() }));

const servicesManager = buildProfile({ permissions: [PERMISSIONS.SERVICES_MANAGE] });
const permissionError = "No tienes permiso para gestionar servicios.";
const validService = {
  category_id: RECORD_ID,
  name: "Corte de cabello",
  duration_hours: "1",
  duration_minutes_part: "30",
  price: "150",
};

describe("services actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(servicesManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("todas las acciones rechazan sin permiso de servicios", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

    expect(await archiveCategoryAction(RECORD_ID)).toEqual({ ok: false, error: permissionError });
    expect(await createCategoryAction(null, formDataOf({ name: "Cortes" }))).toEqual({
      ok: false,
      error: permissionError,
    });
    expect(archiveServiceCategory).not.toHaveBeenCalled();
    expect(createServiceCategory).not.toHaveBeenCalled();
  });

  describe("categorías", () => {
    it("crea la categoría con modo de precio variable y revalida /services", async () => {
      vi.mocked(createServiceCategory).mockResolvedValue(ok("cat-1"));

      const result = await createCategoryAction(
        null,
        formDataOf({ name: "Cortes", ordering: "2", pricing_mode: "variable" })
      );

      expect(result).toEqual({ ok: true, value: "cat-1" });
      expect(createServiceCategory).toHaveBeenCalledWith(SALON_ID, {
        name: "Cortes",
        description: "",
        ordering: 2,
        pricing_mode: "variable",
      });
      expect(revalidatePath).toHaveBeenCalledWith("/services");
    });

    it("usa precio fijo cuando el modo no es 'variable' y rechaza nombre vacío", async () => {
      vi.mocked(createServiceCategory).mockResolvedValue(ok("cat-2"));
      await createCategoryAction(null, formDataOf({ name: "Color", pricing_mode: "otro" }));
      expect(createServiceCategory).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ pricing_mode: "fixed" })
      );

      expect(await createCategoryAction(null, formDataOf({ name: "" }))).toEqual({
        ok: false,
        error: "El nombre es obligatorio",
      });
    });

    it("no revalida si la categoría no se puede crear", async () => {
      vi.mocked(createServiceCategory).mockResolvedValue(err("Ya existe una categoría con ese nombre."));

      expect(await createCategoryAction(null, formDataOf({ name: "Cortes" }))).toEqual({
        ok: false,
        error: "Ya existe una categoría con ese nombre.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("rechaza en servidor un modo de precio fuera del catálogo aunque llegue desde un cliente manipulado", async () => {
      // El tipo TypeScript no basta: una server action recibe datos no confiables.
      const untrustedMode: string = "gratis";

      const result = await updateCategoryPricingModeAction(RECORD_ID, untrustedMode as "fixed");

      expect(result.ok).toBe(false);
      expect(updateServiceCategory).not.toHaveBeenCalled();
    });

    it("actualiza el modo de precio válido y revalida", async () => {
      vi.mocked(updateServiceCategory).mockResolvedValue(ok(undefined));

      expect(await updateCategoryPricingModeAction(RECORD_ID, "variable")).toEqual({
        ok: true,
        value: undefined,
      });
      expect(updateServiceCategory).toHaveBeenCalledWith(
        RECORD_ID,
        SALON_ID,
        expect.objectContaining({ pricing_mode: "variable" })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/services");
    });

    it("archiva la categoría y revalida solo si tiene éxito", async () => {
      vi.mocked(archiveServiceCategory).mockResolvedValue(ok(undefined));
      expect(await archiveCategoryAction(RECORD_ID)).toEqual({ ok: true, value: undefined });
      expect(archiveServiceCategory).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
      expect(revalidatePath).toHaveBeenCalledWith("/services");

      vi.clearAllMocks();
      vi.mocked(requireActiveProfile).mockResolvedValue(servicesManager);
      vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
      vi.mocked(archiveServiceCategory).mockResolvedValue(err("La categoría tiene servicios activos."));
      expect(await archiveCategoryAction(RECORD_ID)).toEqual({
        ok: false,
        error: "La categoría tiene servicios activos.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("servicios", () => {
    it("propaga el rechazo del módulo y del límite de servicios activos", async () => {
      vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
      expect(await createServiceAction(null, formDataOf(validService))).toEqual({
        ok: false,
        error: "Módulo no incluido en tu plan.",
      });

      vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de servicios alcanzado."));
      expect(await createServiceAction(null, formDataOf(validService))).toEqual({
        ok: false,
        error: "Límite de servicios alcanzado.",
      });
      expect(createCatalogService).not.toHaveBeenCalled();
    });

    it("rechaza una duración con minutos fuera de rango antes de validar el resto", async () => {
      const result = await createServiceAction(
        null,
        formDataOf({ ...validService, duration_minutes_part: "75" })
      );

      expect(result).toEqual({
        ok: false,
        error: "Indica una duración valida: horas desde 0 y minutos entre 0 y 59.",
      });
      expect(createCatalogService).not.toHaveBeenCalled();
    });

    it("rechaza una duración de 0 minutos con el mensaje de validación de duración", async () => {
      // La validación de dominio (total >= 1) corta antes que el min(1) de Zod.
      const result = await createServiceAction(
        null,
        formDataOf({ ...validService, duration_hours: "", duration_minutes_part: "" })
      );

      expect(result).toEqual({
        ok: false,
        error: "Indica una duración valida: horas desde 0 y minutos entre 0 y 59.",
      });
      expect(createCatalogService).not.toHaveBeenCalled();
    });

    it("rechaza una categoría inválida y un precio negativo", async () => {
      expect(await createServiceAction(null, formDataOf({ ...validService, category_id: "bad" }))).toEqual({
        ok: false,
        error: "Categoría inválida",
      });
      expect(await createServiceAction(null, formDataOf({ ...validService, price: "-5" }))).toEqual({
        ok: false,
        error: "El precio no puede ser negativo",
      });
      expect(createCatalogService).not.toHaveBeenCalled();
    });

    it("crea el servicio con la duración combinada en minutos y revalida", async () => {
      vi.mocked(createCatalogService).mockResolvedValue(ok("svc-1"));

      const result = await createServiceAction(null, formDataOf(validService));

      expect(result).toEqual({ ok: true, value: "svc-1" });
      expect(createCatalogService).toHaveBeenCalledWith(SALON_ID, {
        category_id: RECORD_ID,
        name: "Corte de cabello",
        description: "",
        duration_minutes: 90,
        price: 150,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/services");
    });

    it("actualiza el servicio convirtiendo el estado activo y la duración", async () => {
      vi.mocked(updateCatalogService).mockResolvedValue(ok(undefined));

      const result = await updateServiceAction(
        RECORD_ID,
        null,
        formDataOf({
          name: "Lavado",
          duration_hours: "0",
          duration_minutes_part: "45",
          price: "120",
          is_active: "false",
        })
      );

      expect(result).toEqual({ ok: true, value: undefined });
      expect(updateCatalogService).toHaveBeenCalledWith(
        RECORD_ID,
        SALON_ID,
        expect.objectContaining({ name: "Lavado", duration_minutes: 45, price: 120, is_active: false })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/services");
    });

    it("rechaza un precio negativo al actualizar y no persiste", async () => {
      const result = await updateServiceAction(
        RECORD_ID,
        null,
        formDataOf({ name: "Lavado", duration_hours: "0", duration_minutes_part: "45", price: "-1" })
      );

      expect(result).toEqual({ ok: false, error: "El precio no puede ser negativo" });
      expect(updateCatalogService).not.toHaveBeenCalled();
    });

    it("rechaza una duración inválida al actualizar", async () => {
      const result = await updateServiceAction(
        RECORD_ID,
        null,
        formDataOf({ name: "Lavado", duration_hours: "-1", duration_minutes_part: "10", price: "10" })
      );

      expect(result).toEqual({
        ok: false,
        error: "Indica una duración valida: horas desde 0 y minutos entre 0 y 59.",
      });
      expect(updateCatalogService).not.toHaveBeenCalled();
    });
  });
});
