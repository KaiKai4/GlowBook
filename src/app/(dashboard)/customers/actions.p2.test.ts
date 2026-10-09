import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
} from "@/features/customers/use-cases/customer-duplicates";
import { archiveCustomer, reactivateCustomer } from "@/features/customers/use-cases/customer-lifecycle";
import { createCustomerProfile, updateCustomerProfile } from "@/features/customers/use-cases/customer-profile";
import {
  deleteTemporaryCustomer,
  findOrCreateTemporaryCustomer,
  promoteCustomer,
} from "@/features/customers/use-cases/customer-temporary";
import { PERMISSIONS } from "@/infra/auth/permissions";
import { requireActiveProfile } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  checkCustomerPhoneAction,
  createCustomerAction,
  deleteCustomerAction,
  deleteTemporaryCustomerAction,
  findArchivedCustomerByContactAction,
  findOrCreateCustomerAction,
  promoteCustomerAction,
  reactivateCustomerAction,
  updateCustomerAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/infra/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-duplicates", () => ({
  checkPermanentCustomerByPhone: vi.fn(),
  findArchivedCustomerByContact: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-profile", () => ({
  createCustomerProfile: vi.fn(),
  updateCustomerProfile: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-lifecycle", () => ({
  archiveCustomer: vi.fn(),
  reactivateCustomer: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-temporary", () => ({
  deleteTemporaryCustomer: vi.fn(),
  findOrCreateTemporaryCustomer: vi.fn(),
  promoteCustomer: vi.fn(),
}));

const INVALID = { ok: false, error: "Identificador inválido." } as const;
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.CUSTOMERS_MANAGE] });

describe("customers actions: guardas de identificador y límite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  });

  it("createCustomerAction devuelve el bloqueo del límite sin crear el cliente", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await createCustomerAction(null, formDataOf({ first_name: "Ana", last_name: "Pérez" }))).toEqual(
      RATE_LIMITED
    );
    expect(checkPlanModuleAccess).not.toHaveBeenCalled();
    expect(createCustomerProfile).not.toHaveBeenCalled();
  });

  it("createCustomerAction aplica el límite de 60 peticiones por minuto en el ámbito customers", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(createCustomerProfile).mockResolvedValue(ok("cli-1"));

    await createCustomerAction(null, formDataOf({ first_name: "Ana", last_name: "Pérez" }));

    expect(assertActionRateLimit).toHaveBeenCalledWith(buildProfile().id, "customers", {
      max: 60,
      windowMs: 60_000,
    });
  });

  it("checkCustomerPhoneAction responde sin existencia cuando el límite bloquea la consulta", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await checkCustomerPhoneAction("+507 6000-0000")).toEqual({ exists: false });
    expect(checkPermanentCustomerByPhone).not.toHaveBeenCalled();
  });

  it("checkCustomerPhoneAction consulta el teléfono dentro del salón", async () => {
    vi.mocked(checkPermanentCustomerByPhone).mockResolvedValue({ exists: true, archived: false });

    expect(await checkCustomerPhoneAction("+507 6000-0000")).toEqual({ exists: true, archived: false });
    expect(checkPermanentCustomerByPhone).toHaveBeenCalledWith(SALON_ID, "+507 6000-0000");
  });

  it("findArchivedCustomerByContactAction devuelve null cuando el límite bloquea", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await findArchivedCustomerByContactAction("+507 6000-0000")).toBeNull();
    expect(findArchivedCustomerByContact).not.toHaveBeenCalled();
  });

  it("findArchivedCustomerByContactAction busca por teléfono y correo del salón", async () => {
    vi.mocked(findArchivedCustomerByContact).mockResolvedValue(null);

    expect(await findArchivedCustomerByContactAction("+507 6000-0000", "ana@example.com")).toBeNull();
    expect(findArchivedCustomerByContact).toHaveBeenCalledWith(SALON_ID, "+507 6000-0000", "ana@example.com");
  });

  it("reactivateCustomerAction rechaza un identificador inválido", async () => {
    expect(await reactivateCustomerAction("cliente")).toEqual(INVALID);
    expect(reactivateCustomer).not.toHaveBeenCalled();
  });

  it("reactivateCustomerAction reactiva y revalida clientes y nueva cita", async () => {
    vi.mocked(reactivateCustomer).mockResolvedValue(ok(undefined));

    expect(await reactivateCustomerAction(RECORD_ID)).toEqual(ok(undefined));
    expect(reactivateCustomer).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/customers");
    expect(revalidatePath).toHaveBeenCalledWith("/appointments/new");
  });

  it("reactivateCustomerAction no revalida cuando falla", async () => {
    vi.mocked(reactivateCustomer).mockResolvedValue(err("No encontrado."));

    expect(await reactivateCustomerAction(RECORD_ID)).toEqual({ ok: false, error: "No encontrado." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("findOrCreateCustomerAction rechaza sin permiso y no crea el temporal", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

    expect(await findOrCreateCustomerAction("Ana", "Pérez")).toEqual({
      ok: false,
      error: "No tienes permiso para gestionar clientes.",
    });
    expect(findOrCreateTemporaryCustomer).not.toHaveBeenCalled();
  });

  it("findOrCreateCustomerAction delega en el cliente temporal del salón", async () => {
    vi.mocked(findOrCreateTemporaryCustomer).mockResolvedValue(ok("tmp-1"));

    expect(await findOrCreateCustomerAction("Ana", "Pérez", "+507 6000-0000")).toEqual(ok("tmp-1"));
    expect(findOrCreateTemporaryCustomer).toHaveBeenCalledWith({
      salonId: SALON_ID,
      firstName: "Ana",
      lastName: "Pérez",
      phone: "+507 6000-0000",
    });
  });

  it("promoteCustomerAction rechaza un identificador inválido", async () => {
    expect(await promoteCustomerAction("cliente")).toEqual(INVALID);
    expect(promoteCustomer).not.toHaveBeenCalled();
  });

  it("promoteCustomerAction promueve y revalida el listado", async () => {
    vi.mocked(promoteCustomer).mockResolvedValue(ok(undefined));

    expect(await promoteCustomerAction(RECORD_ID)).toEqual(ok(undefined));
    expect(promoteCustomer).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/customers");
  });

  it("promoteCustomerAction no revalida cuando la promoción falla", async () => {
    vi.mocked(promoteCustomer).mockResolvedValue(err("No es temporal."));

    expect(await promoteCustomerAction(RECORD_ID)).toEqual({ ok: false, error: "No es temporal." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deleteTemporaryCustomerAction rechaza un identificador inválido", async () => {
    expect(await deleteTemporaryCustomerAction("cliente")).toEqual(INVALID);
    expect(deleteTemporaryCustomer).not.toHaveBeenCalled();
  });

  it("deleteTemporaryCustomerAction elimina el temporal del salón", async () => {
    vi.mocked(deleteTemporaryCustomer).mockResolvedValue(ok(undefined));

    expect(await deleteTemporaryCustomerAction(RECORD_ID)).toEqual(ok(undefined));
    expect(deleteTemporaryCustomer).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
  });

  it("updateCustomerAction rechaza un identificador inválido sin validar el formulario", async () => {
    expect(await updateCustomerAction("cliente", null, formDataOf({ first_name: "Ana" }))).toEqual(INVALID);
    expect(updateCustomerProfile).not.toHaveBeenCalled();
  });

  it("updateCustomerAction rechaza formularios inválidos sin persistir", async () => {
    const result = await updateCustomerAction(RECORD_ID, null, formDataOf({ email: "no-es-email" }));

    expect(result.ok).toBe(false);
    expect(updateCustomerProfile).not.toHaveBeenCalled();
  });

  it("updateCustomerAction actualiza el cliente y revalida el listado", async () => {
    vi.mocked(updateCustomerProfile).mockResolvedValue(ok(undefined));

    expect(await updateCustomerAction(RECORD_ID, null, formDataOf({ first_name: "Ana" }))).toEqual(ok(undefined));
    expect(updateCustomerProfile).toHaveBeenCalledWith(RECORD_ID, SALON_ID, expect.objectContaining({ first_name: "Ana" }));
    expect(revalidatePath).toHaveBeenCalledWith("/customers");
  });

  it("deleteCustomerAction rechaza un identificador inválido sin archivar", async () => {
    expect(await deleteCustomerAction("cliente")).toEqual(INVALID);
    expect(archiveCustomer).not.toHaveBeenCalled();
  });

  it("deleteCustomerAction archiva el cliente y revalida listado y nueva cita", async () => {
    const outcome = ok({ outcome: "archived" as const, message: "Cliente archivado." });
    vi.mocked(archiveCustomer).mockResolvedValue(outcome);

    expect(await deleteCustomerAction(RECORD_ID)).toEqual(outcome);
    expect(archiveCustomer).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/customers");
    expect(revalidatePath).toHaveBeenCalledWith("/appointments/new");
  });
});
