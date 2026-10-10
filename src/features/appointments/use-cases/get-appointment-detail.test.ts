import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { findAppointmentById } from "../data/appointments.repo";
import { getAppointmentDetail } from "./get-appointment-detail";

vi.mock("../data/appointments.repo", () => ({
  findAppointmentById: vi.fn(),
}));

vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));

const mockedFindAppointmentById = vi.mocked(findAppointmentById);
const mockedGetSalonIdentity = vi.mocked(getSalonIdentity);

describe("get appointment detail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindAppointmentById.mockResolvedValue(null);
    mockedGetSalonIdentity.mockResolvedValue(null);
  });

  it("maps appointment rows into a detail view model", async () => {
    mockedFindAppointmentById.mockResolvedValue({
      id: "appointment-1",
      salon_id: "salon-1",
      status: "confirmed",
      start_time: "2026-05-29T15:00:00.000Z",
      end_time: "2026-05-29T16:00:00.000Z",
      discount_amount: "5",
      total_price: "30.5",
      completion_price_note: "Descuento de cortesia",
      notes: "Cliente prefiere la silla 2",
      customer: {
        id: "customer-1",
        first_name: "Lia",
        last_name: "Mora",
        phone: null,
        email: null,
        is_temporary: false,
      },
      items: [
        {
          id: "item-1",
          service_id: "service-1",
          employee_id: "employee-1",
          start_time: "2026-05-29T15:00:00.000Z",
          end_time: "2026-05-29T16:00:00.000Z",
          duration_minutes: 60,
          price: "35.5",
          discount_amount: "5",
          ordering: 1,
          service: {
            id: "service-1",
            name: "Corte",
            duration_minutes: 60,
            category: { id: "cat-1", name: "Cabello", pricing_mode: "fixed" },
          },
          employee: { id: "employee-1", first_name: "Ana", last_name: "Vega" },
        },
      ],
    } as never);
    mockedGetSalonIdentity.mockResolvedValue({
      name: "Glow Studio",
      timezone: "America/Bogota",
      payment_methods: ["cash", "card"],
    });

    const view = await getAppointmentDetail({
      appointmentId: "appointment-1",
      salonId: "salon-1",
    });

    expect(view).toEqual({
      id: "appointment-1",
      status: "confirmed",
      customerName: "Lia Mora",
      customer: {
        first_name: "Lia",
        last_name: "Mora",
      },
      start_time: "2026-05-29T15:00:00.000Z",
      end_time: "2026-05-29T16:00:00.000Z",
      subtotal_price: 35.5,
      discount_amount: 5,
      total_price: 30.5,
      completion_price_note: "Descuento de cortesia",
      notes: "Cliente prefiere la silla 2",
      timezone: "America/Bogota",
      items: [
        {
          id: "item-1",
          serviceId: "service-1",
          employeeId: "employee-1",
          serviceName: "Corte",
          serviceCategoryName: "Cabello",
          pricingMode: "fixed",
          employeeName: "Ana Vega",
          start_time: "2026-05-29T15:00:00.000Z",
          end_time: "2026-05-29T16:00:00.000Z",
          price: 35.5,
          discountAmount: 5,
        },
      ],
    });
  });

  it("returns null when the appointment belongs to another salon", async () => {
    mockedFindAppointmentById.mockResolvedValue({
      id: "appointment-1",
      salon_id: "other-salon",
      status: "scheduled",
      start_time: null,
      end_time: null,
      discount_amount: 0,
      total_price: 0,
      completion_price_note: "",
      notes: null,
      customer: null,
      items: [],
    } as never);

    await expect(
      getAppointmentDetail({ appointmentId: "appointment-1", salonId: "salon-1" })
    ).resolves.toBeNull();
    expect(mockedGetSalonIdentity).not.toHaveBeenCalled();
  });
});
