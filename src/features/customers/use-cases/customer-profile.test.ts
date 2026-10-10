import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { captureError } from "@/infra/observability";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/features/customers/schemas";
import { err, ok, type Result } from "@/infra/result";
import { createCustomerProfile, updateCustomerProfile, type CustomerProfileDeps } from "./customer-profile";

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

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

/** Fakes tipados: por defecto plan con módulo y cupo, sin duplicados y escrituras correctas. */
interface ProfileFakes {
  deps: CustomerProfileDeps;
  checkModuleAccess: Mock<CustomerProfileDeps["checkModuleAccess"]>;
  assertQuota: Mock<CustomerProfileDeps["assertQuota"]>;
  rejectArchivedDuplicate: Mock<CustomerProfileDeps["rejectArchivedDuplicate"]>;
  createCustomer: Mock<CustomerProfileDeps["createCustomer"]>;
  updateCustomer: Mock<CustomerProfileDeps["updateCustomer"]>;
}

function makeFakes(): ProfileFakes {
  const checkModuleAccess = vi.fn<CustomerProfileDeps["checkModuleAccess"]>(async (): Promise<Result<void>> => ok(undefined));
  const assertQuota = vi.fn<CustomerProfileDeps["assertQuota"]>(async (): Promise<Result<void>> => ok(undefined));
  const rejectArchivedDuplicate = vi.fn<CustomerProfileDeps["rejectArchivedDuplicate"]>(
    async (): Promise<Result<void>> => ok(undefined)
  );
  const createCustomer = vi.fn<CustomerProfileDeps["createCustomer"]>(async () => ({ id: "cust-1" }));
  const updateCustomer = vi.fn<CustomerProfileDeps["updateCustomer"]>(async () => ({ id: "cust-1" }));
  return {
    deps: { checkModuleAccess, assertQuota, rejectArchivedDuplicate, createCustomer, updateCustomer },
    checkModuleAccess,
    assertQuota,
    rejectArchivedDuplicate,
    createCustomer,
    updateCustomer,
  };
}

describe("customer-profile", () => {
  let fakes: ProfileFakes;

  beforeEach(() => {
    fakes = makeFakes();
  });

  describe("createCustomerProfile", () => {
    it("normaliza el telefono (sin prefijo 507 ni separadores) antes de crear", async () => {
      const result = await createCustomerProfile(SALON_ID, createInput(), fakes.deps);

      expect(result).toEqual({ ok: true, value: "cust-1" });
      expect(fakes.createCustomer).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ phone: "61234567", first_name: "Ana" })
      );
    });

    it("conserva el input tal cual cuando no hay teléfono", async () => {
      const input = createInput({ phone: undefined });

      await createCustomerProfile(SALON_ID, input, fakes.deps);

      expect(fakes.createCustomer).toHaveBeenCalledWith(SALON_ID, input);
    });

    it("verifica duplicados archivados con el input normalizado y se detiene si hay uno", async () => {
      fakes.rejectArchivedDuplicate.mockResolvedValue({ ok: false, error: "Restauralo para conservar su historial." });

      const result = await createCustomerProfile(SALON_ID, createInput(), fakes.deps);

      expect(result).toEqual({ ok: false, error: "Restauralo para conservar su historial." });
      expect(fakes.rejectArchivedDuplicate).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ phone: "61234567" })
      );
      expect(fakes.createCustomer).not.toHaveBeenCalled();
    });

    it("devuelve el mensaje generico cuando la creación falla por un error no reconocido", async () => {
      fakes.createCustomer.mockRejectedValue(new Error("caida de red"));

      expect(await createCustomerProfile(SALON_ID, createInput(), fakes.deps)).toEqual({
        ok: false,
        error: "Error al crear el cliente.",
      });
    });
  });

  describe("updateCustomerProfile", () => {
    it("normaliza el teléfono y actualiza el cliente del salón", async () => {
      const result = await updateCustomerProfile("cust-1", SALON_ID, { phone: "5076000 1111" }, fakes.deps);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(fakes.updateCustomer).toHaveBeenCalledWith("cust-1", SALON_ID, { phone: "60001111" });
    });

    it("no altera un teléfono vacio y pasa los demas campos sin cambios", async () => {
      const input: UpdateCustomerInput = { phone: "", notes: "Alergia al tinte" };

      await updateCustomerProfile("cust-1", SALON_ID, input, fakes.deps);

      expect(fakes.updateCustomer).toHaveBeenCalledWith("cust-1", SALON_ID, input);
    });

    it("registra el error y devuelve el mensaje generico si la actualización falla", async () => {
      const failure = new Error("caida");
      fakes.updateCustomer.mockRejectedValue(failure);

      const result = await updateCustomerProfile("cust-1", SALON_ID, { notes: "x" }, fakes.deps);

      expect(result).toEqual({ ok: false, error: "Error al actualizar el cliente." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "profile" });
    });

    // Las restricciones de unicidad se reconocen por el nombre del indice; el
    // texto mostrado es el mensaje de dominio del caso de uso.
    it("traduce el conflicto de teléfono y de correo a mensajes de dominio", async () => {
      fakes.updateCustomer.mockRejectedValueOnce(new Error("uq_customer_phone_per_salon"));
      expect(await updateCustomerProfile("cust-1", SALON_ID, { notes: "x" }, fakes.deps)).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese teléfono.",
      });

      fakes.updateCustomer.mockRejectedValueOnce(new Error("uq_customer_email_per_salon"));
      expect(await updateCustomerProfile("cust-1", SALON_ID, { notes: "x" }, fakes.deps)).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese email.",
      });
    });

    it("traduce el conflicto de teléfono y de correo al crear", async () => {
      fakes.createCustomer.mockRejectedValueOnce(new Error("uq_customer_phone_per_salon"));
      expect(await createCustomerProfile(SALON_ID, createInput(), fakes.deps)).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese teléfono.",
      });

      fakes.createCustomer.mockRejectedValueOnce(new Error("uq_customer_email_per_salon"));
      expect(await createCustomerProfile(SALON_ID, createInput(), fakes.deps)).toEqual({
        ok: false,
        error: "Ya existe un cliente con ese email.",
      });
    });
  });
});

describe("createCustomerProfile: plan y cupo", () => {
  let fakes: ProfileFakes;

  beforeEach(() => {
    fakes = makeFakes();
  });

  it("consulta el módulo de clientes y el cupo de clientes activos del salón", async () => {
    await createCustomerProfile(SALON_ID, createInput(), fakes.deps);

    expect(fakes.checkModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "customers" });
    expect(fakes.assertQuota).toHaveBeenCalledWith(SALON_ID);
  });

  it("da de alta el cliente en el salón cuando el plan lo permite", async () => {
    expect(await createCustomerProfile(SALON_ID, createInput(), fakes.deps)).toEqual(ok("cust-1"));
    expect(fakes.createCustomer).toHaveBeenCalledTimes(1);
  });

  it("si el módulo no está en el plan devuelve su error sin crear", async () => {
    fakes.checkModuleAccess.mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createCustomerProfile(SALON_ID, createInput(), fakes.deps)).toEqual(
      err("Módulo no incluido en tu plan.")
    );
    expect(fakes.assertQuota).not.toHaveBeenCalled();
    expect(fakes.createCustomer).not.toHaveBeenCalled();
  });

  it("si no queda cupo de clientes devuelve el error del plan sin crear", async () => {
    fakes.assertQuota.mockResolvedValue(err("Límite de clientes alcanzado."));

    expect(await createCustomerProfile(SALON_ID, createInput(), fakes.deps)).toEqual(
      err("Límite de clientes alcanzado.")
    );
    expect(fakes.createCustomer).not.toHaveBeenCalled();
  });
});
