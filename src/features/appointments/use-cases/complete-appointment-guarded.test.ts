import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSalonPaymentMethodEnabled } from "@/features/salon";
import type { CompleteAppointmentInput } from "@/features/appointments/schemas";
import { err, ok } from "@/infra/result";
import { completeAppointment } from "./complete-appointment";
import { completeAppointmentGuarded } from "./complete-appointment-guarded";

vi.mock("@/features/salon", () => ({ assertSalonPaymentMethodEnabled: vi.fn() }));
vi.mock("./complete-appointment", () => ({ completeAppointment: vi.fn() }));

const SALON_ID = "00000000-0000-4000-8000-0000000000a1";
const APPOINTMENT_ID = "00000000-0000-4000-8000-0000000000d4";
const KEY = "00000000-0000-4000-8000-0000000000c3";
const input: CompleteAppointmentInput = {
  appointment_id: APPOINTMENT_ID,
  idempotency_key: KEY,
  payment_method: "cash",
  completion_price_note: "Propina incluida",
  item_charges: [{ id: "00000000-0000-4000-8000-0000000000e5", price: 150 }],
} as CompleteAppointmentInput;

describe("completeAppointmentGuarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(true);
    vi.mocked(completeAppointment).mockResolvedValue(ok(undefined));
  });

  it("comprueba que el método de pago esté habilitado en el salón", async () => {
    await completeAppointmentGuarded(input, SALON_ID);

    expect(assertSalonPaymentMethodEnabled).toHaveBeenCalledWith(SALON_ID, "cash");
  });

  it("completa la cita con los datos del formulario cuando el método está habilitado", async () => {
    const result = await completeAppointmentGuarded(input, SALON_ID);

    expect(completeAppointment).toHaveBeenCalledWith(
      APPOINTMENT_ID,
      SALON_ID,
      "cash",
      input.item_charges,
      "Propina incluida",
      KEY
    );
    expect(result).toEqual(ok(undefined));
  });

  it("un método de pago deshabilitado devuelve su mensaje sin completar", async () => {
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(false);

    expect(await completeAppointmentGuarded(input, SALON_ID)).toEqual(
      err("Ese metodo de pago no esta habilitado para este salon.")
    );
    expect(completeAppointment).not.toHaveBeenCalled();
  });

  it("propaga el error del caso de uso de completar", async () => {
    vi.mocked(completeAppointment).mockResolvedValue(err("Cita no encontrada."));

    expect(await completeAppointmentGuarded(input, SALON_ID)).toEqual(err("Cita no encontrada."));
  });
});
