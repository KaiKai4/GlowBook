import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { promoteCustomer } from "@/features/customers/use-cases/customer-temporary";
import { captureError } from "@/lib/observability";
import {
  findAppointmentForCommand,
  findAppointmentItemsForPricing,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentItemCharges,
  updateAppointmentStatus,
  type AppointmentCommandState,
  type AppointmentItemPricingState,
} from "../data/appointment-commands.repo";
import { completeAppointment, type CompleteAppointmentPriceInput } from "./complete-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
  findAppointmentItemsForPricing: vi.fn(),
  setAppointmentItemsCalendarBlocking: vi.fn(),
  updateAppointmentItemCharges: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-temporary", () => ({
  promoteCustomer: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000c1";
const salonId = "00000000-0000-4000-8000-0000000000d1";
const customerId = "00000000-0000-4000-8000-0000000000e1";

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedItems = vi.mocked(findAppointmentItemsForPricing);
const mockedRelease = vi.mocked(setAppointmentItemsCalendarBlocking);
const mockedCharges = vi.mocked(updateAppointmentItemCharges);
const mockedStatus = vi.mocked(updateAppointmentStatus);
const mockedPromote = vi.mocked(promoteCustomer);
const mockedCaptureError = vi.mocked(captureError);

const fixedItem: AppointmentItemPricingState = {
  id: "item-fixed",
  price: 20,
  discount_amount: 0,
  pricing_mode: "fixed",
};

const variableItem: AppointmentItemPricingState = {
  id: "item-variable",
  price: 30,
  discount_amount: 0,
  pricing_mode: "variable",
};

function appointment(overrides: Partial<AppointmentCommandState> = {}): AppointmentCommandState {
  return {
    id: appointmentId,
    salon_id: salonId,
    status: "scheduled",
    customer_id: customerId,
    ...overrides,
  };
}

function completeWith(
  prices: CompleteAppointmentPriceInput[] = [],
  note = ""
) {
  return completeAppointment(appointmentId, salonId, "cash", prices, note);
}

describe("completeAppointment: cobro y totales", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointment());
    mockedItems.mockResolvedValue([fixedItem, variableItem]);
    mockedCharges.mockResolvedValue(undefined);
    mockedRelease.mockResolvedValue(undefined);
    mockedStatus.mockResolvedValue(undefined);
    mockedPromote.mockResolvedValue({ ok: true, value: undefined });
  });

  it("cobra los precios actuales sin reescribir ítems cuando nadie los cambió", async () => {
    const result = await completeWith();

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedCharges).not.toHaveBeenCalled();
    expect(mockedStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "completed",
      paymentMethod: "cash",
      discountAmount: 0,
      totalPrice: 50,
      completionPriceNote: "",
    });
  });

  it("aplica el descuento por ítem y escribe solo el ítem cuyo cobro cambió", async () => {
    await completeWith([{ id: "item-variable", price: 30, discountPercentage: 10 }]);

    expect(mockedCharges).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      charges: [{ id: "item-variable", price: 30, discountAmount: 3 }],
    });
    expect(mockedStatus).toHaveBeenCalledWith(
      expect.objectContaining({ discountAmount: 3, totalPrice: 47 })
    );
  });

  it("recalcula el subtotal con el precio variable nuevo", async () => {
    await completeWith([{ id: "item-variable", price: 45 }]);

    expect(mockedCharges).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      charges: [{ id: "item-variable", price: 45, discountAmount: 0 }],
    });
    expect(mockedStatus).toHaveBeenCalledWith(expect.objectContaining({ totalPrice: 65 }));
  });

  it("redondea el precio enviado a centavos antes de guardarlo", async () => {
    await completeWith([{ id: "item-variable", price: 45.126 }]);

    expect(mockedCharges).toHaveBeenCalledWith(
      expect.objectContaining({
        charges: [expect.objectContaining({ id: "item-variable", price: 45.13 })],
      })
    );
  });

  it("permite cambiar solo el descuento de un servicio de precio fijo", async () => {
    const result = await completeWith([{ id: "item-fixed", price: 20, discountPercentage: 50 }]);

    expect(result.ok).toBe(true);
    expect(mockedCharges).toHaveBeenCalledWith(
      expect.objectContaining({
        charges: [{ id: "item-fixed", price: 20, discountAmount: 10 }],
      })
    );
    expect(mockedStatus).toHaveBeenCalledWith(expect.objectContaining({ totalPrice: 40, discountAmount: 10 }));
  });

  it("sin descuento enviado trata el porcentaje como cero", async () => {
    await completeWith([{ id: "item-variable", price: 31 }]);

    expect(mockedStatus).toHaveBeenCalledWith(expect.objectContaining({ discountAmount: 0, totalPrice: 51 }));
  });

  it("recorta la nota de cierre: quita espacios y limita a 500 caracteres", async () => {
    await completeWith([], `  ${"n".repeat(600)}  `);

    const call = mockedStatus.mock.calls[0]?.[0];
    expect(call?.completionPriceNote).toBe("n".repeat(500));
  });

  it("guarda la nota sin espacios sobrantes", async () => {
    await completeWith([], "  Cortesía del salón  ");

    expect(mockedStatus).toHaveBeenCalledWith(
      expect.objectContaining({ completionPriceNote: "Cortesía del salón" })
    );
  });

  it("propiedad: el total cobrado es subtotal menos descuentos y nunca es negativo", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 100 }),
        async (cents, discountPercentage) => {
          vi.clearAllMocks();
          mockedFind.mockResolvedValue(appointment());
          mockedItems.mockResolvedValue([variableItem]);

          await completeAppointment(appointmentId, salonId, "card", [
            { id: "item-variable", price: cents / 100, discountPercentage },
          ]);

          const call = mockedStatus.mock.calls[0]?.[0];
          expect(call?.totalPrice).toBeGreaterThanOrEqual(0);
          expect(call?.discountAmount).toBeLessThanOrEqual(cents / 100 + 0.005);
          expect(Math.abs((call?.totalPrice ?? 0) + (call?.discountAmount ?? 0) - cents / 100)).toBeLessThan(0.011);
        }
      ),
      { numRuns: 60 }
    );
  });
});

describe("completeAppointment: validación de precios", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointment());
    mockedItems.mockResolvedValue([fixedItem, variableItem]);
    mockedCharges.mockResolvedValue(undefined);
    mockedStatus.mockResolvedValue(undefined);
    mockedRelease.mockResolvedValue(undefined);
    mockedPromote.mockResolvedValue({ ok: true, value: undefined });
  });

  it("rechaza un precio para un servicio que no pertenece a la cita", async () => {
    const result = await completeWith([{ id: "item-ajeno", price: 10 }]);

    expect(result).toEqual({ ok: false, error: "Precio de servicio inválido." });
    expect(mockedCharges).not.toHaveBeenCalled();
    expect(mockedStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["negativo", -1],
    ["no numérico", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("rechaza un precio %s", async (_label, price) => {
    const result = await completeWith([{ id: "item-variable", price }]);

    expect(result).toEqual({ ok: false, error: "El precio del servicio no puede ser negativo." });
    expect(mockedStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["por debajo de 0", -5],
    ["por encima de 100", 101],
    ["no numérico", Number.NaN],
  ])("rechaza un descuento %s", async (_label, discountPercentage) => {
    const result = await completeWith([{ id: "item-variable", price: 30, discountPercentage }]);

    expect(result).toEqual({
      ok: false,
      error: "El descuento del servicio debe estar entre 0% y 100%.",
    });
    expect(mockedCharges).not.toHaveBeenCalled();
    expect(mockedStatus).not.toHaveBeenCalled();
  });

  it("rechaza cambiar el precio de un servicio de precio fijo", async () => {
    const result = await completeWith([{ id: "item-fixed", price: 25 }]);

    expect(result).toEqual({
      ok: false,
      error: "Solo puedes cambiar el precio de servicios con precio variable.",
    });
    expect(mockedCharges).not.toHaveBeenCalled();
    expect(mockedStatus).not.toHaveBeenCalled();
  });

  it("no cobra una cita sin servicios", async () => {
    mockedItems.mockResolvedValue([]);

    expect(await completeWith()).toEqual({
      ok: false,
      error: "La cita no tiene servicios para cobrar.",
    });
    expect(mockedStatus).not.toHaveBeenCalled();
    expect(mockedRelease).not.toHaveBeenCalled();
  });
});

describe("completeAppointment: transición y errores de escritura", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue(appointment());
    mockedItems.mockResolvedValue([fixedItem, variableItem]);
    mockedCharges.mockResolvedValue(undefined);
    mockedStatus.mockResolvedValue(undefined);
    mockedRelease.mockResolvedValue(undefined);
    mockedPromote.mockResolvedValue({ ok: true, value: undefined });
  });

  it("no busca ítems ni escribe si la cita ya fue cancelada", async () => {
    mockedFind.mockResolvedValue(appointment({ status: "cancelled" }));

    expect(await completeWith()).toEqual({
      ok: false,
      error: 'No se puede cambiar el estado de "cancelled" a "completed".',
    });
    expect(mockedItems).not.toHaveBeenCalled();
    expect(mockedStatus).not.toHaveBeenCalled();
  });

  it("devuelve 'Cita no encontrada.' cuando la cita no existe en el salón", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await completeWith()).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedItems).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("read failed");
    mockedFind.mockRejectedValue(failure);

    expect(await completeWith()).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "complete",
    });
  });

  it("si falla leer los ítems devuelve error de cobro y registra el fallo", async () => {
    const failure = new Error("items failed");
    mockedItems.mockRejectedValue(failure);

    expect(await completeWith()).toEqual({
      ok: false,
      error: "Error al calcular el cobro de la cita.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "complete",
    });
    expect(mockedStatus).not.toHaveBeenCalled();
  });

  it("si falla guardar los cargos no marca la cita como completada", async () => {
    mockedCharges.mockRejectedValue(new Error("charges failed"));

    expect(await completeWith([{ id: "item-variable", price: 40 }])).toEqual({
      ok: false,
      error: "Error al calcular el cobro de la cita.",
    });
    expect(mockedStatus).not.toHaveBeenCalled();
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it("si falla el estado devuelve error y no libera la agenda ni promueve al cliente", async () => {
    mockedStatus.mockRejectedValue(new Error("status failed"));

    expect(await completeWith()).toEqual({ ok: false, error: "Error al completar la cita." });
    expect(mockedRelease).not.toHaveBeenCalled();
    expect(mockedPromote).not.toHaveBeenCalled();
  });

  it("si la cita se completó pero no se libera la agenda lo informa sin promover al cliente", async () => {
    mockedRelease.mockRejectedValue(new Error("release failed"));

    expect(await completeWith()).toEqual({
      ok: false,
      error: "La cita se completo, pero no se pudo liberar la agenda.",
    });
    expect(mockedStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    expect(mockedPromote).not.toHaveBeenCalled();
  });

  it("promueve al cliente temporal después de liberar la agenda", async () => {
    const order: string[] = [];
    mockedRelease.mockImplementation(async () => {
      order.push("release");
    });
    mockedPromote.mockImplementation(async () => {
      order.push("promote");
      return { ok: true, value: undefined };
    });

    expect(await completeWith()).toEqual({ ok: true, value: undefined });
    expect(order).toEqual(["release", "promote"]);
    expect(mockedPromote).toHaveBeenCalledWith(customerId, salonId);
  });

  it("no promueve nada cuando la cita no tiene cliente", async () => {
    mockedFind.mockResolvedValue(appointment({ customer_id: null }));

    expect(await completeWith()).toEqual({ ok: true, value: undefined });
    expect(mockedPromote).not.toHaveBeenCalled();
  });

  it("si la promoción del cliente falla la cita sigue completada y el error se registra", async () => {
    mockedPromote.mockResolvedValue({ ok: false, error: "Error al guardar el cliente." });

    expect(await completeWith()).toEqual({ ok: true, value: undefined });
    expect(mockedStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    expect(mockedCaptureError).toHaveBeenCalledWith("Error al guardar el cliente.", {
      module: "appointments",
      action: "complete",
    });
  });
});
