import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "./salon-identity";
import {
  assertSalonPaymentMethodEnabled,
  getSalonPaymentMethods,
} from "./salon-payment-methods";

vi.mock("./salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));

const mockedGetSalonIdentity = vi.mocked(getSalonIdentity);

describe("salon payment methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSalonPaymentMethods", () => {
    it("devuelve los metodos configurados del salon con sus etiquetas", async () => {
      mockedGetSalonIdentity.mockResolvedValue({
        name: "Glow",
        timezone: "UTC",
        payment_methods: ["cash", "yappy", "Cheque"],
      });

      expect(await getSalonPaymentMethods("salon-1")).toEqual({
        enabled: ["cash", "yappy", "Cheque"],
        options: [
          { value: "cash", label: "Efectivo" },
          { value: "yappy", label: "Yappy" },
          { value: "Cheque", label: "Cheque" },
        ],
      });
      expect(mockedGetSalonIdentity).toHaveBeenCalledWith("salon-1");
    });

    it("usa los metodos por defecto cuando el salon no existe o no tiene metodos", async () => {
      mockedGetSalonIdentity.mockResolvedValue(null);

      const view = await getSalonPaymentMethods("salon-missing");

      expect(view.enabled).toEqual(["cash", "card", "transfer", "yappy", "other"]);
      expect(view.options).toHaveLength(5);
      expect(view.options[1]).toEqual({ value: "card", label: "Tarjeta" });
    });
  });

  describe("assertSalonPaymentMethodEnabled", () => {
    it("acepta un metodo habilitado sin distinguir mayusculas ni espacios extra", async () => {
      mockedGetSalonIdentity.mockResolvedValue({
        name: "Glow",
        timezone: "UTC",
        payment_methods: ["Tarjeta Débito"],
      });

      expect(await assertSalonPaymentMethodEnabled("salon-1", "  tarjeta   débito ")).toBe(true);
    });

    it("rechaza un metodo que el salon no tiene habilitado", async () => {
      mockedGetSalonIdentity.mockResolvedValue({
        name: "Glow",
        timezone: "UTC",
        payment_methods: ["cash"],
      });

      expect(await assertSalonPaymentMethodEnabled("salon-1", "card")).toBe(false);
    });

    it("evalua contra los metodos por defecto cuando el salon no tiene configuracion", async () => {
      mockedGetSalonIdentity.mockResolvedValue(null);

      expect(await assertSalonPaymentMethodEnabled("salon-1", "yappy")).toBe(true);
      expect(await assertSalonPaymentMethodEnabled("salon-1", "bitcoin")).toBe(false);
    });
  });
});
