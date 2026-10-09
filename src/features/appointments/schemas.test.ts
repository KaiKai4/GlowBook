import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CompleteAppointmentSchema,
  CreateAppointmentSchema,
  UpdateAppointmentScheduleSchema,
} from "./schemas";

const customerId = "00000000-0000-4000-8000-000000000001";
const appointmentId = "00000000-0000-4000-8000-000000000002";
const serviceId = "00000000-0000-4000-8000-000000000003";
const employeeId = "00000000-0000-4000-8000-000000000004";

const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
const validAssignment = { service_id: serviceId, employee_id: employeeId };

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: customerId,
    start_time: "2030-01-01T14:00:00.000Z",
    assignments: [validAssignment],
    idempotency_key: idempotencyKey,
    ...overrides,
  };
}

function completeInput(overrides: Record<string, unknown> = {}) {
  return {
    appointment_id: appointmentId,
    idempotency_key: idempotencyKey,
    payment_method: "cash",
    item_charges: [{ id: serviceId, price: 25 }],
    ...overrides,
  };
}

function issuePaths(result: { success: false; error: { issues: Array<{ path: PropertyKey[] }> } }) {
  return result.error.issues.map((issue) => issue.path.map(String).join("."));
}

describe("CreateAppointmentSchema", () => {
  it("acepta una cita válida y completa las notas vacías por defecto", () => {
    const parsed = CreateAppointmentSchema.parse(createInput());

    expect(parsed.notes).toBe("");
    expect(parsed.assignments).toEqual([validAssignment]);
  });

  it("exige una clave de idempotencia uuid", () => {
    expect(CreateAppointmentSchema.safeParse(createInput({ idempotency_key: undefined })).success).toBe(false);
    expect(CreateAppointmentSchema.safeParse(createInput({ idempotency_key: "" })).success).toBe(false);
  });

  it("rechaza ids que no son UUID en cliente, servicio o profesional", () => {
    const badCustomer = CreateAppointmentSchema.safeParse(createInput({ customer_id: "cliente-1" }));
    const badService = CreateAppointmentSchema.safeParse(
      createInput({ assignments: [{ service_id: "servicio", employee_id: employeeId }] })
    );
    const badEmployee = CreateAppointmentSchema.safeParse(
      createInput({ assignments: [{ service_id: serviceId, employee_id: "profesional" }] })
    );

    expect(badCustomer.success).toBe(false);
    expect(badService.success).toBe(false);
    expect(badEmployee.success).toBe(false);
    if (!badService.success) expect(issuePaths(badService)).toEqual(["assignments.0.service_id"]);
    if (!badEmployee.success) expect(issuePaths(badEmployee)).toEqual(["assignments.0.employee_id"]);
  });

  it("exige fecha y hora con formato ISO completo", () => {
    expect(CreateAppointmentSchema.safeParse(createInput({ start_time: "2030-01-01" })).success).toBe(false);
    expect(CreateAppointmentSchema.safeParse(createInput({ start_time: "2030-01-01T14:00:00" })).success).toBe(false);
    expect(CreateAppointmentSchema.safeParse(createInput({ start_time: "2030-01-01T14:00:00.000Z" })).success).toBe(
      true
    );
  });

  it("exige al menos un servicio", () => {
    const result = CreateAppointmentSchema.safeParse(createInput({ assignments: [] }));

    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toEqual(["assignments"]);
  });

  it("limita las notas a 1000 caracteres", () => {
    expect(CreateAppointmentSchema.safeParse(createInput({ notes: "n".repeat(1000) })).success).toBe(true);
    expect(CreateAppointmentSchema.safeParse(createInput({ notes: "n".repeat(1001) })).success).toBe(false);
  });

  it("propiedad: cualquier lista de servicios válida no vacía se acepta sin cambios", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (count) => {
        const assignments = Array.from({ length: count }, () => validAssignment);
        const parsed = CreateAppointmentSchema.parse(createInput({ assignments }));

        expect(parsed.assignments).toHaveLength(count);
      })
    );
  });
});

describe("UpdateAppointmentScheduleSchema", () => {
  const updateInput = (overrides: Record<string, unknown> = {}) => ({
    appointment_id: appointmentId,
    start_time: "2030-01-01T14:00:00.000Z",
    assignments: [validAssignment],
    idempotency_key: idempotencyKey,
    ...overrides,
  });

  it("acepta una reprogramación válida y completa las notas", () => {
    const parsed = UpdateAppointmentScheduleSchema.parse(updateInput());

    expect(parsed).toMatchObject({ appointment_id: appointmentId, notes: "", idempotency_key: idempotencyKey });
  });

  it("exige una clave de idempotencia uuid", () => {
    expect(UpdateAppointmentScheduleSchema.safeParse(updateInput({ idempotency_key: undefined })).success).toBe(false);
    expect(UpdateAppointmentScheduleSchema.safeParse(updateInput({ idempotency_key: "clave" })).success).toBe(false);
  });

  it("rechaza un id de cita que no es UUID", () => {
    const result = UpdateAppointmentScheduleSchema.safeParse(updateInput({ appointment_id: "cita" }));

    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toEqual(["appointment_id"]);
  });

  it("CONDUCTA ACTUAL (posible bug): el mensaje de id inválido llega con codificación doble (mojibake)", () => {
    const result = UpdateAppointmentScheduleSchema.safeParse(updateInput({ appointment_id: "cita" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("ID de cita inválido");
    }
  });

  it("exige fecha ISO y al menos un servicio", () => {
    expect(UpdateAppointmentScheduleSchema.safeParse(updateInput({ start_time: "manana" })).success).toBe(false);
    expect(UpdateAppointmentScheduleSchema.safeParse(updateInput({ assignments: [] })).success).toBe(false);
  });
});

describe("CompleteAppointmentSchema", () => {
  it("acepta un cobro válido con valores por defecto de nota y descuento", () => {
    const parsed = CompleteAppointmentSchema.parse(completeInput());

    expect(parsed.completion_price_note).toBe("");
    expect(parsed.item_charges).toEqual([{ id: serviceId, price: 25, discountPercentage: 0 }]);
  });

  it("exige una clave de idempotencia uuid", () => {
    expect(CompleteAppointmentSchema.safeParse(completeInput({ idempotency_key: undefined })).success).toBe(false);
    expect(CompleteAppointmentSchema.safeParse(completeInput({ idempotency_key: "x" })).success).toBe(false);
  });

  it("normaliza el método de pago: quita espacios sobrantes y colapsa los internos", () => {
    const parsed = CompleteAppointmentSchema.parse(
      completeInput({ payment_method: "  Tarjeta    de   credito  " })
    );

    expect(parsed.payment_method).toBe("Tarjeta de credito");
  });

  it("rechaza un método de pago vacío o solo con espacios", () => {
    const result = CompleteAppointmentSchema.safeParse(completeInput({ payment_method: "   " }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("El metodo de pago es obligatorio.");
    }
  });

  it("rechaza un método de pago de más de 64 caracteres", () => {
    const result = CompleteAppointmentSchema.safeParse(completeInput({ payment_method: "p".repeat(65) }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("El metodo de pago no puede superar 64 caracteres.");
    }
  });

  it("exige al menos un servicio cobrado", () => {
    const result = CompleteAppointmentSchema.safeParse(completeInput({ item_charges: [] }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("La cita debe tener al menos un servicio");
    }
  });

  it("rechaza precios negativos con mensaje de dominio", () => {
    const result = CompleteAppointmentSchema.safeParse(
      completeInput({ item_charges: [{ id: serviceId, price: -1 }] })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("El precio no puede ser negativo");
    }
  });

  it("acota el descuento entre 0 y 100 con mensajes propios", () => {
    const negative = CompleteAppointmentSchema.safeParse(
      completeInput({ item_charges: [{ id: serviceId, price: 25, discountPercentage: -1 }] })
    );
    const tooHigh = CompleteAppointmentSchema.safeParse(
      completeInput({ item_charges: [{ id: serviceId, price: 25, discountPercentage: 101 }] })
    );
    const limit = CompleteAppointmentSchema.safeParse(
      completeInput({ item_charges: [{ id: serviceId, price: 25, discountPercentage: 100 }] })
    );

    if (!negative.success) expect(negative.error.issues[0]?.message).toBe("El descuento no puede ser negativo");
    if (!tooHigh.success) expect(tooHigh.error.issues[0]?.message).toBe("El descuento no puede ser mayor a 100%");
    expect(negative.success).toBe(false);
    expect(tooHigh.success).toBe(false);
    expect(limit.success).toBe(true);
  });

  it("rechaza un id de servicio que no es UUID dentro de los cobros", () => {
    const result = CompleteAppointmentSchema.safeParse(
      completeInput({ item_charges: [{ id: "servicio", price: 10 }] })
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(issuePaths(result)).toEqual(["item_charges.0.id"]);
  });

  it("limita la nota de cierre a 500 caracteres", () => {
    expect(CompleteAppointmentSchema.safeParse(completeInput({ completion_price_note: "n".repeat(500) })).success).toBe(
      true
    );
    expect(CompleteAppointmentSchema.safeParse(completeInput({ completion_price_note: "n".repeat(501) })).success).toBe(
      false
    );
  });
});
