import { describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import type { AppointmentCommandState } from "../data/appointment-commands.repo";
import type { CompleteAppointmentRpcInput, CompleteAppointmentRpcResult } from "../data/rpc/complete-appointment";
import {
  completeAppointment,
  type CompleteAppointmentCommand,
  type CompleteAppointmentDeps,
} from "./complete-appointment";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const mockedCapture = vi.mocked(captureError);

const appointmentId = "appointment-1";
const salonId = "salon-1";
const idempotencyKey = "00000000-0000-4000-8000-0000000000e1";

const rpcResult: CompleteAppointmentRpcResult = {
  appointment_id: appointmentId,
  status: "completed",
  subtotal: 15,
  discount_amount: 0,
  total_price: 15,
};

function command(overrides: Partial<CompleteAppointmentCommand> = {}): CompleteAppointmentCommand {
  return {
    appointmentId,
    salonId,
    paymentMethod: "cash",
    itemCharges: [],
    completionPriceNote: "",
    idempotencyKey,
    ...overrides,
  };
}

function appointmentIn(status: AppointmentCommandState["status"]): AppointmentCommandState {
  return { id: appointmentId, salon_id: salonId, status, customer_id: "customer-1" };
}

/** Fakes tipados: por defecto, método de pago habilitado, cita confirmada y RPC correcta. */
function makeDeps(overrides: Partial<CompleteAppointmentDeps> = {}): CompleteAppointmentDeps {
  return {
    isPaymentMethodEnabled: vi.fn<CompleteAppointmentDeps["isPaymentMethodEnabled"]>(async () => true),
    findAppointment: vi.fn<CompleteAppointmentDeps["findAppointment"]>(async () => appointmentIn("confirmed")),
    completeRpc: vi.fn<CompleteAppointmentDeps["completeRpc"]>(async () => rpcResult),
    ...overrides,
  };
}

describe("completeAppointment: transición y datos enviados a la RPC", () => {
  it("busca la cita dentro del salón y envía todo en una única RPC", async () => {
    const deps = makeDeps();

    const result = await completeAppointment(
      command({ paymentMethod: "card", itemCharges: [{ id: "item-1", price: 15 }] }),
      deps
    );

    expect(result).toEqual({ ok: true, value: rpcResult });
    expect(deps.findAppointment).toHaveBeenCalledWith(appointmentId, salonId);
    expect(deps.completeRpc).toHaveBeenCalledTimes(1);
    expect(deps.completeRpc).toHaveBeenCalledWith({
      appointmentId,
      paymentMethod: "card",
      completionPriceNote: "",
      itemCharges: [{ id: "item-1", price: 15 }],
      idempotencyKey,
    });
  });

  it("devuelve el total final que calcula el servidor, no un cálculo local", async () => {
    const deps = makeDeps({
      completeRpc: async () => ({ ...rpcResult, subtotal: 20, discount_amount: 4, total_price: 16 }),
    });

    const result = await completeAppointment(command(), deps);

    expect(result).toEqual({
      ok: true,
      value: { ...rpcResult, subtotal: 20, discount_amount: 4, total_price: 16 },
    });
  });

  it("sin cobros enviados la RPC recibe una lista vacía", async () => {
    const deps = makeDeps();

    await completeAppointment(command({ itemCharges: undefined }), deps);

    expect(deps.completeRpc).toHaveBeenCalledWith(expect.objectContaining({ itemCharges: [] }));
  });

  it("recorta la nota de cierre: quita espacios y limita a 500 caracteres", async () => {
    const deps = makeDeps();

    await completeAppointment(command({ completionPriceNote: `  ${"n".repeat(600)}  ` }), deps);

    const sent: CompleteAppointmentRpcInput | undefined = vi.mocked(deps.completeRpc).mock.calls[0]?.[0];
    expect(sent?.completionPriceNote).toBe("n".repeat(500));
  });

  it("reenvía la clave de idempotencia y el descuento por item en camelCase", async () => {
    const deps = makeDeps();

    await completeAppointment(
      command({ itemCharges: [{ id: "item-1", price: 20, discountPercentage: 20 }] }),
      deps
    );

    expect(deps.completeRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey,
        itemCharges: [{ id: "item-1", price: 20, discountPercentage: 20 }],
      })
    );
  });
});

describe("completeAppointment: método de pago del salón", () => {
  it("comprueba que el método de pago esté habilitado en el salón antes de nada", async () => {
    const deps = makeDeps();

    await completeAppointment(command({ paymentMethod: "cash" }), deps);

    expect(deps.isPaymentMethodEnabled).toHaveBeenCalledWith(salonId, "cash");
  });

  it("un método de pago deshabilitado devuelve su mensaje sin buscar ni completar la cita", async () => {
    const deps = makeDeps({ isPaymentMethodEnabled: async () => false });

    expect(await completeAppointment(command(), deps)).toEqual({
      ok: false,
      error: "Ese método de pago no está habilitado para este salón.",
    });
    expect(deps.findAppointment).not.toHaveBeenCalled();
    expect(deps.completeRpc).not.toHaveBeenCalled();
  });
});

describe("completeAppointment: errores", () => {
  it("devuelve 'Cita no encontrada.' cuando la cita no existe en el salón", async () => {
    const deps = makeDeps({ findAppointment: async () => null });

    expect(await completeAppointment(command(), deps)).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(deps.completeRpc).not.toHaveBeenCalled();
  });

  it("si falla la lectura de la cita informa 'Cita no encontrada.' y registra el error", async () => {
    const failure = new Error("db down");
    const deps = makeDeps({
      findAppointment: async () => {
        throw failure;
      },
    });

    expect(await completeAppointment(command(), deps)).toEqual({ ok: false, error: "Cita no encontrada." });
    expect(mockedCapture).toHaveBeenCalledWith(failure, { module: "appointments", action: "complete" });
  });

  it("una transición inválida devuelve el motivo de dominio y no llama a la RPC", async () => {
    const deps = makeDeps({ findAppointment: async () => appointmentIn("cancelled") });

    expect(await completeAppointment(command(), deps)).toEqual({
      ok: false,
      error: 'No se puede cambiar el estado de "cancelled" a "completed".',
    });
    expect(deps.completeRpc).not.toHaveBeenCalled();
  });

  it("muestra el mensaje de validación de la base (SQLSTATE 22023)", async () => {
    // Texto literal de la RPC (supabase/migrations): sin tilde, porque el passthrough muestra el mensaje tal cual.
    const bdMessage = "Ese metodo de pago no esta habilitado para este salon.";
    const deps = makeDeps({
      completeRpc: async () => {
        throw { code: "22023", message: bdMessage };
      },
    });

    expect(await completeAppointment(command({ paymentMethod: "cash" }), deps)).toEqual({
      ok: false,
      error: bdMessage,
    });
  });

  it("un fallo interno de la RPC devuelve el mensaje genérico sin filtrar detalles", async () => {
    const deps = makeDeps({
      completeRpc: async () => {
        throw new Error('relation "appointments" does not exist');
      },
    });

    expect(await completeAppointment(command(), deps)).toEqual({ ok: false, error: "Error al completar la cita." });
  });
});
