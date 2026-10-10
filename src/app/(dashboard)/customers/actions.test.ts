import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { createCustomerProfile, updateCustomerProfile } from "@/features/customers/use-cases/customer-profile";
import { archiveCustomer, reactivateCustomer } from "@/features/customers/use-cases/customer-lifecycle";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
} from "@/features/customers/use-cases/customer-duplicates";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  createCustomerAction,
  checkCustomerPhoneAction,
  findArchivedCustomerByContactAction,
  reactivateCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  const requireActiveProfile = vi.fn();
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-profile", () => ({
  createCustomerProfile: vi.fn(),
  updateCustomerProfile: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-lifecycle", () => ({
  archiveCustomer: vi.fn(),
  reactivateCustomer: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-duplicates", () => ({
  checkPermanentCustomerByPhone: vi.fn(),
  findArchivedCustomerByContact: vi.fn(),
}));

const manager = buildProfile({ permissions: [PERMISSIONS.CUSTOMERS_MANAGE] });
const validCustomer = { first_name: "Ana", last_name: "Pérez", phone: "61234567" };
const noPermissionError = "No tienes permiso para gestionar clientes.";

describe("customers actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  describe("createCustomerAction", () => {
    it("rechaza a un perfil sin permiso de clientes y no persiste", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      const result = await createCustomerAction(null, formDataOf(validCustomer));

      expect(result).toEqual({ ok: false, error: noPermissionError });
      expect(createCustomerProfile).not.toHaveBeenCalled();
    });

    it("rechaza cuando el límite de peticiones está agotado", async () => {
      vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));

      const result = await createCustomerAction(null, formDataOf(validCustomer));

      expect(result).toEqual({ ok: false, error: "Demasiados intentos." });
      expect(createCustomerProfile).not.toHaveBeenCalled();
    });

    it("devuelve el rechazo del caso de uso (módulo o cupo del plan) tal cual", async () => {
      vi.mocked(createCustomerProfile).mockResolvedValueOnce(err("Módulo no incluido en tu plan."));
      expect(await createCustomerAction(null, formDataOf(validCustomer))).toEqual({
        ok: false,
        error: "Módulo no incluido en tu plan.",
      });

      vi.mocked(createCustomerProfile).mockResolvedValueOnce(err("Límite de clientes alcanzado."));
      expect(await createCustomerAction(null, formDataOf(validCustomer))).toEqual({
        ok: false,
        error: "Límite de clientes alcanzado.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("devuelve el primer issue de Zod sin persistir", async () => {
      const result = await createCustomerAction(null, formDataOf({ ...validCustomer, first_name: "" }));

      expect(result).toEqual({ ok: false, error: "El nombre es obligatorio" });
      expect(createCustomerProfile).not.toHaveBeenCalled();
    });

    it("crea el cliente con el salón del perfil y revalida /customers", async () => {
      vi.mocked(createCustomerProfile).mockResolvedValue(ok("cust-1"));

      const result = await createCustomerAction(null, formDataOf(validCustomer));

      expect(result).toEqual({ ok: true, value: "cust-1" });
      expect(createCustomerProfile).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ first_name: "Ana", last_name: "Pérez", phone: "61234567" })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/customers");
    });

    it("no revalida cuando el caso de uso falla", async () => {
      vi.mocked(createCustomerProfile).mockResolvedValue(err("Teléfono duplicado."));

      const result = await createCustomerAction(null, formDataOf(validCustomer));

      expect(result).toEqual({ ok: false, error: "Teléfono duplicado." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateCustomerAction", () => {
    it("rechaza un campo inválido con el mensaje de Zod", async () => {
      const result = await updateCustomerAction(RECORD_ID, null, formDataOf({ last_name: "" }));

      expect(result).toEqual({ ok: false, error: "El apellido es obligatorio" });
      expect(updateCustomerProfile).not.toHaveBeenCalled();
    });

    it("rechaza a un perfil sin permiso", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      const result = await updateCustomerAction(RECORD_ID, null, formDataOf({ first_name: "Ana" }));

      expect(result).toEqual({ ok: false, error: noPermissionError });
      expect(updateCustomerProfile).not.toHaveBeenCalled();
    });

    it("actualiza el cliente y revalida /customers", async () => {
      vi.mocked(updateCustomerProfile).mockResolvedValue(ok(undefined));

      const result = await updateCustomerAction(RECORD_ID, null, formDataOf({ first_name: "Lucía" }));

      expect(result).toEqual({ ok: true, value: undefined });
      expect(updateCustomerProfile).toHaveBeenCalledWith(
        RECORD_ID,
        SALON_ID,
        expect.objectContaining({ first_name: "Lucía" })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/customers");
    });

    // Regresión F02-3: archivar, reactivar o convertir temporal no se hace editando.
    it("no envía is_active ni is_temporary al caso de uso aunque el formulario los incluya", async () => {
      vi.mocked(updateCustomerProfile).mockResolvedValue(ok(undefined));

      const result = await updateCustomerAction(
        RECORD_ID,
        null,
        formDataOf({ first_name: "Lucía", is_active: "false", is_temporary: "true" })
      );

      expect(result).toEqual({ ok: true, value: undefined });
      expect(updateCustomerProfile).toHaveBeenCalledTimes(1);
      const data: object = vi.mocked(updateCustomerProfile).mock.calls[0]?.[2] ?? {};
      expect(data).not.toHaveProperty("is_active");
      expect(data).not.toHaveProperty("is_temporary");
    });
  });

  describe("consultas de duplicados y contacto", () => {
    it("checkCustomerPhoneAction devuelve exists=false sin consultar si no hay permiso", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await checkCustomerPhoneAction("61234567")).toEqual({ exists: false });
      expect(checkPermanentCustomerByPhone).not.toHaveBeenCalled();
    });

    it("checkCustomerPhoneAction delega en la búsqueda del salón", async () => {
      vi.mocked(checkPermanentCustomerByPhone).mockResolvedValue({ exists: true, archived: false });

      expect(await checkCustomerPhoneAction("61234567")).toEqual({ exists: true, archived: false });
      expect(checkPermanentCustomerByPhone).toHaveBeenCalledWith(SALON_ID, "61234567");
    });

    it("findArchivedCustomerByContactAction devuelve null sin permiso y delega con permiso", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
      expect(await findArchivedCustomerByContactAction("61234567")).toBeNull();
      expect(findArchivedCustomerByContact).not.toHaveBeenCalled();

      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(findArchivedCustomerByContact).mockResolvedValue(null);
      expect(await findArchivedCustomerByContactAction("61234567", "a@b.co")).toBeNull();
      expect(findArchivedCustomerByContact).toHaveBeenCalledWith(SALON_ID, "61234567", "a@b.co");
    });
  });

  describe("entrada inválida en consultas de contacto", () => {
    it("checkCustomerPhoneAction no consulta con un teléfono inválido", async () => {
      expect(await checkCustomerPhoneAction("2123-4567")).toEqual({ exists: false });
      expect(await checkCustomerPhoneAction("")).toEqual({ exists: false });
      expect(checkPermanentCustomerByPhone).not.toHaveBeenCalled();
    });

    it("findArchivedCustomerByContactAction no consulta con un teléfono o email inválido", async () => {
      expect(await findArchivedCustomerByContactAction("2123-4567")).toBeNull();
      expect(await findArchivedCustomerByContactAction(undefined, "no-es-correo")).toBeNull();
      expect(findArchivedCustomerByContact).not.toHaveBeenCalled();
    });

  });

  describe("ciclo de vida", () => {
    it("reactivateCustomerAction rechaza sin permiso y revalida al reactivar", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
      expect(await reactivateCustomerAction(RECORD_ID)).toEqual({ ok: false, error: noPermissionError });
      expect(reactivateCustomer).not.toHaveBeenCalled();

      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(reactivateCustomer).mockResolvedValue(ok(undefined));
      expect(await reactivateCustomerAction(RECORD_ID)).toEqual({ ok: true, value: undefined });
      expect(revalidatePath).toHaveBeenCalledWith("/customers");
      expect(revalidatePath).toHaveBeenCalledWith("/appointments/new");
    });

    it("deleteCustomerAction archiva y revalida; si falla no revalida", async () => {
      vi.mocked(archiveCustomer).mockResolvedValue(ok({ outcome: "archived", message: "Archivado." }));
      expect(await deleteCustomerAction(RECORD_ID)).toEqual({
        ok: true,
        value: { outcome: "archived", message: "Archivado." },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/customers");

      vi.clearAllMocks();
      vi.mocked(requireActiveProfile).mockResolvedValue(manager);
      vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
      vi.mocked(archiveCustomer).mockResolvedValue(err("No encontrado."));
      expect(await deleteCustomerAction(RECORD_ID)).toEqual({ ok: false, error: "No encontrado." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
