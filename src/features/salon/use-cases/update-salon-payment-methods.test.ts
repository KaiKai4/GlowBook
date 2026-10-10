import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { updateSalonPaymentMethods as updateSalonPaymentMethodsRepo } from "../data/salon-settings.repo";
import { updateSalonPaymentMethods } from "./update-salon-payment-methods";

vi.mock("../data/salon-settings.repo", () => ({
  updateSalonPaymentMethods: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedUpdatePaymentMethods = vi.mocked(updateSalonPaymentMethodsRepo);
const mockedCaptureError = vi.mocked(captureError);

const SAVE_FAILED = "No se pudieron guardar los métodos de pago.";

describe("updateSalonPaymentMethods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normaliza los metodos (espacios y duplicados sin distinguir mayusculas) antes de guardarlos", async () => {
    mockedUpdatePaymentMethods.mockResolvedValue(undefined);

    const result = await updateSalonPaymentMethods("salon-1", [
      "  cash ",
      "Cash",
      "Tarjeta   débito",
      "",
      "yappy",
    ]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpdatePaymentMethods).toHaveBeenCalledWith("salon-1", [
      "cash",
      "Tarjeta débito",
      "yappy",
    ]);
    expect(mockedCaptureError).not.toHaveBeenCalled();
  });

  it("no expone al usuario el detalle de una migracion pendiente, pero registra el error", async () => {
    const failure = {
      code: "42703",
      message: 'column "payment_methods" does not exist',
    };
    mockedUpdatePaymentMethods.mockRejectedValue(failure);

    const result = await updateSalonPaymentMethods("salon-1", ["cash"]);

    expect(result).toEqual({ ok: false, error: SAVE_FAILED });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "salon",
      action: "update-payment-methods",
    });
  });

  it("no concatena el mensaje de una instancia de Error", async () => {
    mockedUpdatePaymentMethods.mockRejectedValue(new Error("fallo de red"));

    const result = await updateSalonPaymentMethods("salon-1", ["cash"]);

    expect(result).toEqual({ ok: false, error: SAVE_FAILED });
    expect(mockedCaptureError).toHaveBeenCalledTimes(1);
  });

  it("no muestra el mensaje crudo de objetos con propiedad message", async () => {
    mockedUpdatePaymentMethods.mockRejectedValue({ code: "XX000", message: "bloqueado" });

    expect(await updateSalonPaymentMethods("salon-1", ["cash"])).toEqual({ ok: false, error: SAVE_FAILED });
  });

  it("devuelve el mismo mensaje fijo cuando el error no es un objeto", async () => {
    mockedUpdatePaymentMethods.mockRejectedValue("texto suelto");

    expect(await updateSalonPaymentMethods("salon-1", ["cash"])).toEqual({ ok: false, error: SAVE_FAILED });
    expect(mockedCaptureError).toHaveBeenCalledWith("texto suelto", {
      module: "salon",
      action: "update-payment-methods",
    });
  });
});
