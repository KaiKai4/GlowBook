import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { findAppointmentById, type AppointmentWithDetails } from "../data/appointments.repo";
import { getAppointmentDetail } from "./get-appointment-detail";

vi.mock("../data/appointments.repo", () => ({
  findAppointmentById: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));

const mockedFind = vi.mocked(findAppointmentById);
const mockedIdentity = vi.mocked(getSalonIdentity);

const salonId = "salon-1";

type Item = AppointmentWithDetails["items"][number];

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    service_id: "service-1",
    employee_id: "employee-1",
    start_time: "2026-05-29T15:00:00.000Z",
    end_time: "2026-05-29T16:00:00.000Z",
    duration_minutes: 60,
    price: 20,
    discount_amount: 0,
    ordering: 1,
    service: {
      id: "service-1",
      name: "Corte",
      duration_minutes: 60,
      category: { id: "cat-1", name: "Cabello", pricing_mode: "fixed" },
    },
    employee: { id: "employee-1", first_name: "Ana", last_name: "Vega" },
    ...overrides,
  };
}

function appointment(overrides: Partial<AppointmentWithDetails> = {}): AppointmentWithDetails {
  return {
    id: "appointment-1",
    salon_id: salonId,
    status: "scheduled",
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
    customer: {
      id: "customer-1",
      first_name: "Lia",
      last_name: "Mora",
      phone: null,
      email: null,
      is_temporary: false,
    },
    items: [item()],
    ...overrides,
  };
}

/** Simula columnas numéricas nulas que llegan de la BD aunque el tipo generado no lo admita. */
function withNullFields<T extends object>(row: T, keys: string[]): T {
  return { ...row, ...Object.fromEntries(keys.map((key) => [key, null])) };
}

describe("getAppointmentDetail: estado", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "America/Panama", payment_methods: [] });
  });

  it.each(["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const)(
    "devuelve el estado %s tal cual, sin traducirlo",
    async (status) => {
      mockedFind.mockResolvedValue(appointment({ status }));

      const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

      expect(view?.status).toBe(status);
    }
  );
});

describe("getAppointmentDetail: cliente, colaborador y servicio", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "America/Panama", payment_methods: [] });
  });

  it("sin cliente muestra 'Cliente sin nombre' y no expone datos de cliente", async () => {
    mockedFind.mockResolvedValue(appointment({ customer: null }));

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view).toMatchObject({ customerName: "Cliente sin nombre", customer: null });
  });

  it("recorta espacios sobrantes del nombre del cliente", async () => {
    mockedFind.mockResolvedValue(
      appointment({
        customer: { id: "c", first_name: "Lia", last_name: "", phone: null, email: null, is_temporary: true },
      })
    );

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.customerName).toBe("Lia");
    expect(view?.customer).toEqual({ first_name: "Lia", last_name: "" });
  });

  it("sin colaborador asignado usa el texto 'Colaborador no asignado'", async () => {
    mockedFind.mockResolvedValue(appointment({ items: [item({ employee: null })] }));

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.items[0]?.employeeName).toBe("Colaborador no asignado");
  });

  it("un servicio eliminado conserva la fila con el nombre de respaldo", async () => {
    mockedFind.mockResolvedValue(appointment({ items: [item({ service: null })] }));

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.items[0]).toMatchObject({
      serviceName: "Servicio eliminado",
      serviceCategoryName: "Sin categoría",
      pricingMode: "fixed",
    });
  });

  it("un servicio sin categoría usa 'Sin categoría' y precio fijo", async () => {
    mockedFind.mockResolvedValue(
      appointment({
        items: [item({ service: { id: "service-1", name: "Manicura", duration_minutes: 30, category: null } })],
      })
    );

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.items[0]).toMatchObject({
      serviceName: "Manicura",
      serviceCategoryName: "Sin categoría",
      pricingMode: "fixed",
    });
  });

  it("reconoce el precio variable de la categoría del servicio", async () => {
    mockedFind.mockResolvedValue(
      appointment({
        items: [
          item({
            service: {
              id: "service-1",
              name: "Pedicura",
              duration_minutes: 60,
              category: { id: "cat-2", name: "Pies", pricing_mode: "variable" },
            },
          }),
        ],
      })
    );

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.items[0]?.pricingMode).toBe("variable");
  });
});

describe("getAppointmentDetail: importes y notas", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calcula el subtotal como suma de precios de ítems y convierte importes nulos a cero", async () => {
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "America/Panama", payment_methods: [] });
    mockedFind.mockResolvedValue(
      withNullFields(
        appointment({
          items: [
            item({ id: "a", price: 20, discount_amount: 2 }),
            withNullFields(item({ id: "b", price: 15.5 }), ["discount_amount"]),
          ],
        }),
        ["discount_amount", "total_price"]
      )
    );

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view).toMatchObject({
      subtotal_price: 35.5,
      discount_amount: 0,
      total_price: 0,
    });
    expect(view?.items.map((row) => row.discountAmount)).toEqual([2, 0]);
  });

  it("las notas de cierre vacías se muestran como null y las notas vacías se conservan", async () => {
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "America/Panama", payment_methods: [] });
    mockedFind.mockResolvedValue(appointment({ completion_price_note: "", notes: "" }));

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.completion_price_note).toBeNull();
    expect(view?.notes).toBe("");
  });

  it("usa la zona horaria del salón cuando la identidad existe", async () => {
    mockedIdentity.mockResolvedValue({ name: "Glow", timezone: "Europe/Madrid", payment_methods: [] });
    mockedFind.mockResolvedValue(appointment());

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.timezone).toBe("Europe/Madrid");
    expect(mockedIdentity).toHaveBeenCalledWith(salonId);
  });

  it("usa la zona horaria por defecto cuando no hay identidad del salón", async () => {
    mockedIdentity.mockResolvedValue(null);
    mockedFind.mockResolvedValue(appointment());

    const view = await getAppointmentDetail({ appointmentId: "appointment-1", salonId });

    expect(view?.timezone).toBe("America/Panama");
  });

  it("no consulta la identidad del salón cuando la cita no existe o es de otro salón", async () => {
    mockedFind.mockResolvedValue(null);
    expect(await getAppointmentDetail({ appointmentId: "appointment-1", salonId })).toBeNull();

    mockedFind.mockResolvedValue(appointment({ salon_id: "salon-2" }));
    expect(await getAppointmentDetail({ appointmentId: "appointment-1", salonId })).toBeNull();

    expect(mockedIdentity).not.toHaveBeenCalled();
  });
});
