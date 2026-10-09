import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { completeAppointmentRpc } from "../data/rpc/complete-appointment";
import { completeAppointment } from "./complete-appointment";

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
}));

vi.mock("../data/rpc/complete-appointment", () => ({
  completeAppointmentRpc: vi.fn(),
}));

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedRpc = vi.mocked(completeAppointmentRpc);
const mockedCapture = vi.mocked(captureError);

const appointmentId = "appointment-1";
const salonId = "salon-1";

describe("completeAppointment: transición y datos enviados a la RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "confirmed",
      customer_id: "customer-1",
    });
    mockedRpc.mockResolvedValue({
      appointment_id: appointmentId,
      status: "completed",
      subtotal: 15,
      discount_amount: 0,
      total_price: 15,
    });
  });

  it("busca la cita dentro del salón y envía todo en una única RPC", async () => {
    const result = await completeAppointment(appointmentId, salonId, "card", [
      { id: "item-1", price: 15 },
    ]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFind).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc).toHaveBeenCalledWith({
      appointmentId,
      paymentMethod: "card",
      completionPriceNote: "",
      itemCharges: [{ id: "item-1", price: 15, discount_percentage: undefined }],
      idempotencyKey: undefined,
    });
  });

  it("sin cobros enviados la RPC conserva precios (lista vacía)", async () => {
    await completeAppointment(appointmentId, salonId, "cash");

    expect(mockedRpc).toHaveBeenCalledWith(expect.objectContaining({ itemCharges: [] }));
  });

  it("recorta la nota de cierre: quita espacios y limita a 500 caracteres", async () => {
    await completeAppointment(appointmentId, salonId, "cash", [], `  ${"n".repeat(600)}  `);

    const [input] = mockedRpc.mock.calls[0] ?? [];
    expect(input?.completionPriceNote).toBe("n".repeat(500));
  });

  it("reenvía la clave de idempotencia cuando se recibe", async () => {
    const key = "00000000-0000-4000-8000-0000000000e1";

    await completeAppointment(appointmentId, salonId, "cash", [], "", key);

    expect(mockedRpc).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: key }));
  });
});

describe("completeAppointment: errores", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devuelve 'Cita no encontrada.' cuando la cita no existe en el salón", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await completeAppointment(appointmentId, salonId, "cash")).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("si falla la lectura de la cita informa 'Cita no encontrada.' y registra el error", async () => {
    const failure = new Error("db down");
    mockedFind.mockRejectedValue(failure);

    expect(await completeAppointment(appointmentId, salonId, "cash")).toEqual({
      ok: false,
      error: "Cita no encontrada.",
    });
    expect(mockedCapture).toHaveBeenCalledWith(failure, { module: "appointments", action: "complete" });
  });

  it("una transición inválida devuelve el motivo de dominio y no llama a la RPC", async () => {
    mockedFind.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "cancelled",
      customer_id: "customer-1",
    });

    expect(await completeAppointment(appointmentId, salonId, "cash")).toEqual({
      ok: false,
      error: 'No se puede cambiar el estado de "cancelled" a "completed".',
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("muestra el mensaje de validación de la base (SQLSTATE 22023)", async () => {
    mockedFind.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "scheduled",
      customer_id: null,
    });
    mockedRpc.mockRejectedValue({
      code: "22023",
      message: "Ese metodo de pago no esta habilitado para este salon.",
    });

    expect(await completeAppointment(appointmentId, salonId, "bitcoin")).toEqual({
      ok: false,
      error: "Ese metodo de pago no esta habilitado para este salon.",
    });
  });

  it("un fallo interno de la RPC devuelve el mensaje genérico sin filtrar detalles", async () => {
    mockedFind.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "scheduled",
      customer_id: null,
    });
    mockedRpc.mockRejectedValue(new Error('relation "appointments" does not exist'));

    expect(await completeAppointment(appointmentId, salonId, "cash")).toEqual({
      ok: false,
      error: "Error al completar la cita.",
    });
  });
});
