import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { createCustomer, updateCustomer } from "@/features/customers/data/customers.repo";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/features/customers/schemas";
import { err, ok } from "@/infra/result";
import { rejectArchivedDuplicate } from "./customer-duplicates";
import { createCustomerProfile, updateCustomerProfile } from "./customer-profile";

vi.mock("@/features/customers/data/customers.repo", () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock("./customer-duplicates", () => ({
  rejectArchivedDuplicate: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));

const mockedCreateCustomer = vi.mocked(createCustomer);
const mockedUpdateCustomer = vi.mocked(updateCustomer);
const mockedRejectArchived = vi.mocked(rejectArchivedDuplicate);
const mockedCaptureError = vi.mocked(captureError);

const SALON_ID = "salon-1";

function createInput(overrides: Partial<CreateCustomerInput> = {}): CreateCustomerInput {
  return {
    first_name: "Ana",
    last_name: "Perez",
    phone: "+507 6123-4567",
    email: "ana@example.com",
    birth_date: null,
    notes: "",
    is_temporary: false,
    ...overrides,
  };
}

const customerRow = {
  id: "cust-1",
  salon_id: SALON_ID,
  first_name: "Ana",
  last_name: "Perez",
  phone: "61234567",
  email: "ana@example.com",
  birth_date: null,
  notes: "",
  is_temporary: false,
  is_active: true,
  search_name: "perez ana",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

describe("customer-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRejectArchived.mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  describe("createCustomerProfile", () => {
    it("normaliza el telefono (sin prefijo 507 ni separadores) antes de crear", async () => {
      mockedCreateCustomer.mockResolvedValue(customerRow);

      const result = await createCustomerProfile(SALON_ID, createInput());

      expect(result).toEqual({ ok: true, value: "cust-1" });
      expect(mockedCreateCustomer).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ phone: "61234567", first_name: "Ana" })
      );
    });

    it("conserva el input tal cual cuando no hay teléfono", async () => {
      mockedCreateCustomer.mockResolvedValue(customerRow);
      const input = createInput({ phone: undefined });

      await createCustomerProfile(SALON_ID, input);

      expect(mockedCreateCustomer).toHaveBeenCalledWith(SALON_ID, input);
    });

    it("verifica duplicados archivados con el input normalizado y se detiene si hay uno", async () => {
      mockedRejectArchived.mockResolvedValue({ ok: false, error: "Restauralo para conservar su historial." });

      const result = await createCustomerProfile(SALON_ID, createInput());

      expect(result).toEqual({ ok: false, error: "Restauralo para conservar su historial." });
      expect(mockedRejectArchived).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ phone: "61234567" })
      );
      expect(mockedCreateCustomer).not.toHaveBeenCalled();
    });

    it("devuelve el mensaje generico cuando la creación falla por un error no reconocido", async () => {
      mockedCreateCustomer.mockRejectedValue(new Error("caida de red"));

      expect(await createCustomerProfile(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Error al crear el cliente.",
      });
    });
  });

  describe("updateCustomerProfile", () => {
    it("normaliza el teléfono y actualiza el cliente del salón", async () => {
      mockedUpdateCustomer.mockResolvedValue(customerRow);

      const result = await updateCustomerProfile("cust-1", SALON_ID, { phone: "5076000 1111" });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedUpdateCustomer).toHaveBeenCalledWith("cust-1", SALON_ID, { phone: "60001111" });
    });

    it("no altera un teléfono vacio y pasa los demas campos sin cambios", async () => {
      mockedUpdateCustomer.mockResolvedValue(customerRow);
      const input: UpdateCustomerInput = { phone: "", notes: "Alergia al tinte" };

      await updateCustomerProfile("cust-1", SALON_ID, input);

      expect(mockedUpdateCustomer).toHaveBeenCalledWith("cust-1", SALON_ID, input);
    });

    it("registra el error y devuelve el mensaje generico si la actualización falla", async () => {
      const failure = new Error("caida");
      mockedUpdateCustomer.mockRejectedValue(failure);

      const result = await updateCustomerProfile("cust-1", SALON_ID, { notes: "x" });

      expect(result).toEqual({ ok: false, error: "Error al actualizar el cliente." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "profile" });
    });

    // Las restricciones de unicidad se reconocen por el nombre del indice; el
    // texto mostrado es el mensaje de dominio del caso de uso.
    it("traduce el conflicto de teléfono y de correo a mensajes de dominio", async () => {
      mockedUpdateCustomer.mockRejectedValueOnce(new Error("uq_customer_phone_per_salon"));
      expect(await updateCustomerProfile("cust-1", SALON_ID, { notes: "x" })).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese teléfono.",
      });

      mockedUpdateCustomer.mockRejectedValueOnce(new Error("uq_customer_email_per_salon"));
      expect(await updateCustomerProfile("cust-1", SALON_ID, { notes: "x" })).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese email.",
      });
    });

    it("traduce el conflicto de teléfono y de correo al crear", async () => {
      mockedCreateCustomer.mockRejectedValueOnce(new Error("uq_customer_phone_per_salon"));
      expect(await createCustomerProfile(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese teléfono.",
      });

      mockedCreateCustomer.mockRejectedValueOnce(new Error("uq_customer_email_per_salon"));
      expect(await createCustomerProfile(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese email.",
      });
    });
  });
});

describe("createCustomerProfile: plan y cupo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRejectArchived.mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    mockedCreateCustomer.mockResolvedValue(customerRow);
  });

  it("consulta el módulo de clientes y el cupo de clientes activos del salón", async () => {
    await createCustomerProfile(SALON_ID, createInput());

    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "customers" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "customers.active" });
  });

  it("da de alta el cliente en el salón cuando el plan lo permite", async () => {
    expect(await createCustomerProfile(SALON_ID, createInput())).toEqual(ok("cust-1"));
    expect(mockedCreateCustomer).toHaveBeenCalledTimes(1);
  });

  it("si el módulo no está en el plan devuelve su error sin crear", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createCustomerProfile(SALON_ID, createInput())).toEqual(err("Módulo no incluido en tu plan."));
    expect(checkPlanLimit).not.toHaveBeenCalled();
    expect(mockedCreateCustomer).not.toHaveBeenCalled();
  });

  it("si no queda cupo de clientes devuelve el error del plan sin crear", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de clientes alcanzado."));

    expect(await createCustomerProfile(SALON_ID, createInput())).toEqual(err("Límite de clientes alcanzado."));
    expect(mockedCreateCustomer).not.toHaveBeenCalled();
  });
});
