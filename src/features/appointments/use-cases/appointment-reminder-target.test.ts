import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAppointmentById, type AppointmentWithDetails } from "../data/appointments.repo";
import { getAppointmentReminderTarget } from "./appointment-reminder-target";

vi.mock("../data/appointments.repo", () => ({
  findAppointmentById: vi.fn(),
}));

const mockedFind = vi.mocked(findAppointmentById);

const appointmentId = "00000000-0000-4000-8000-0000000000i1";
const salonId = "00000000-0000-4000-8000-0000000000i2";

function appointmentWithCustomer(
  customer: AppointmentWithDetails["customer"]
): AppointmentWithDetails {
  return {
    id: appointmentId,
    salon_id: salonId,
    status: "confirmed",
    start_time: "2026-05-29T15:00:00.000Z",
    end_time: "2026-05-29T16:00:00.000Z",
    customer_id: "customer-1",
    created_by: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
    discount_amount: 0,
    total_price: 20,
    payment_method: "cash",
    completion_price_note: "",
    notes: "",
    customer,
    items: [],
  };
}

describe("getAppointmentReminderTarget", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devuelve null cuando la cita no existe", async () => {
    mockedFind.mockResolvedValue(null);

    expect(await getAppointmentReminderTarget(appointmentId)).toBeNull();
    expect(mockedFind).toHaveBeenCalledWith(appointmentId);
  });

  it("entrega el salón y el teléfono del cliente para enviar el recordatorio", async () => {
    mockedFind.mockResolvedValue(
      appointmentWithCustomer({
        id: "customer-1",
        first_name: "Lia",
        last_name: "Mora",
        phone: "+507 6000-0000",
        email: null,
        is_temporary: false,
      })
    );

    expect(await getAppointmentReminderTarget(appointmentId)).toEqual({
      salonId,
      customerPhone: "+507 6000-0000",
    });
  });

  it("sin teléfono registrado el teléfono queda indefinido", async () => {
    mockedFind.mockResolvedValue(
      appointmentWithCustomer({
        id: "customer-1",
        first_name: "Lia",
        last_name: "Mora",
        phone: null,
        email: "lia@example.com",
        is_temporary: false,
      })
    );

    const target = await getAppointmentReminderTarget(appointmentId);

    expect(target).toEqual({ salonId, customerPhone: undefined });
    expect(target?.customerPhone).toBeUndefined();
  });

  it("sin cliente asociado no inventa teléfono", async () => {
    mockedFind.mockResolvedValue(appointmentWithCustomer(null));

    expect(await getAppointmentReminderTarget(appointmentId)).toEqual({
      salonId,
      customerPhone: undefined,
    });
  });
});
