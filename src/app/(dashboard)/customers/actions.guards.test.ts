import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPermanentCustomerByPhone, findArchivedCustomerByContact } from "@/features/customers/use-cases/customer-duplicates";
import { createCustomerProfile, updateCustomerProfile } from "@/features/customers/use-cases/customer-profile";
import { archiveCustomer, reactivateCustomer } from "@/features/customers/use-cases/customer-lifecycle";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, USER_ID } from "@/test/action-fixtures";
import {
  checkCustomerPhoneAction,
  createCustomerAction,
  deleteCustomerAction,
  findArchivedCustomerByContactAction,
  reactivateCustomerAction,
  updateCustomerAction,
} from "./actions";

const { requireActiveProfile } = vi.hoisted(() => ({ requireActiveProfile: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({ checkPlanLimit: vi.fn(), checkPlanModuleAccess: vi.fn() }));
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

const CUSTOMER_ID = RECORD_ID;
const manager = buildProfile({ permissions: [PERMISSIONS.CUSTOMERS_MANAGE] });
const LIMITED = err("Demasiados intentos.");

describe("customers actions: rate limit por acción", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(LIMITED);
  });

  it("aplica el ámbito customers con 60 peticiones por minuto", async () => {
    await reactivateCustomerAction(CUSTOMER_ID);

    expect(assertActionRateLimit).toHaveBeenCalledWith(USER_ID, "customers", { max: 60, windowMs: 60_000 });
  });

  it("createCustomerAction devuelve el rechazo sin crear el cliente", async () => {
    expect(await createCustomerAction(null, formDataOf({ first_name: "Ana" }))).toEqual(LIMITED);
    expect(createCustomerProfile).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("las consultas de duplicados devuelven su respuesta vacía cuando el límite bloquea", async () => {
    expect(await checkCustomerPhoneAction("600000000")).toEqual({ exists: false });
    expect(await findArchivedCustomerByContactAction("600000000")).toBeNull();
    expect(checkPermanentCustomerByPhone).not.toHaveBeenCalled();
    expect(findArchivedCustomerByContact).not.toHaveBeenCalled();
  });

  it("las consultas de duplicados devuelven el resultado del caso de uso sin límite", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPermanentCustomerByPhone).mockResolvedValue({ exists: true, archived: false });
    vi.mocked(findArchivedCustomerByContact).mockResolvedValue(null);

    expect(await checkCustomerPhoneAction("600000000")).toEqual({ exists: true, archived: false });
    expect(await findArchivedCustomerByContactAction("600000000", "a@b.co")).toBeNull();
    expect(findArchivedCustomerByContact).toHaveBeenCalledWith(expect.any(String), "600000000", "a@b.co");
  });

  it("las acciones de ciclo de vida devuelven el rechazo sin tocar el cliente", async () => {
    const formData = formDataOf({ first_name: "Ana", last_name: "Ruiz" });

    expect(await reactivateCustomerAction(CUSTOMER_ID)).toEqual(LIMITED);
    expect(await updateCustomerAction(CUSTOMER_ID, null, formData)).toEqual(LIMITED);
    expect(await deleteCustomerAction(CUSTOMER_ID)).toEqual(LIMITED);
    expect(reactivateCustomer).not.toHaveBeenCalled();
    expect(updateCustomerProfile).not.toHaveBeenCalled();
    expect(archiveCustomer).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

});
