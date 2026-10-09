import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import {
  parseCompleteAppointmentForm,
  parseCreateAppointmentForm,
  parseUpdateAppointmentScheduleForm,
} from "./appointment-form-parsing";

const CUSTOMER_ID = "8f1c2d3e-4a5b-4c6d-8e7f-901112131415";
const APPOINTMENT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const SERVICE_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const EMPLOYEE_ID = "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f";
const IDEMPOTENCY_KEY = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const CHARGES = JSON.stringify([{ id: SERVICE_ID, price: 100 }]);
const START = "2026-10-10T10:00:00.000Z";

const ASSIGNMENTS = JSON.stringify([{ service_id: SERVICE_ID, employee_id: EMPLOYEE_ID }]);

function createForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    customer_id: CUSTOMER_ID,
    start_time: START,
    notes: "",
    assignments: ASSIGNMENTS,
    idempotency_key: IDEMPOTENCY_KEY,
    ...overrides,
  };
}

function completeForm(overrides: Record<string, string | null> = {}): FormData {
  const values: Record<string, string | null> = {
    appointment_id: APPOINTMENT_ID,
    idempotency_key: IDEMPOTENCY_KEY,
    payment_method: "cash",
    completion_price_note: "",
    item_charges: CHARGES,
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null) formData.set(key, value);
  }
  return formData;
}

describe("parseCreateAppointmentForm", () => {
  it("parsea los servicios JSON y valida el resto del formulario", () => {
    const result = parseCreateAppointmentForm(createForm());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assignments).toEqual([{ service_id: SERVICE_ID, employee_id: EMPLOYEE_ID }]);
    expect(result.value.customer_id).toBe(CUSTOMER_ID);
    expect(result.value.idempotency_key).toBe(IDEMPOTENCY_KEY);
  });

  it("si los servicios no son JSON devuelve el mensaje de datos invalidos", () => {
    expect(parseCreateAppointmentForm(createForm({ assignments: "{no-json" }))).toEqual(
      err("Datos de servicios invalidos.")
    );
  });

  it("si falta el campo de servicios devuelve el mensaje de datos invalidos", () => {
    const form: Record<string, string> = createForm();
    delete form.assignments;

    expect(parseCreateAppointmentForm(form)).toEqual(err("Datos de servicios invalidos."));
  });

  it("devuelve el primer error de validacion del schema", () => {
    expect(parseCreateAppointmentForm(createForm({ assignments: "[]" }))).toEqual(
      err("Selecciona al menos un servicio")
    );
  });
});

describe("parseUpdateAppointmentScheduleForm", () => {
  it("parsea la reprogramacion con el id de cita", () => {
    const result = parseUpdateAppointmentScheduleForm({
      appointment_id: APPOINTMENT_ID,
      start_time: START,
      notes: "",
      assignments: ASSIGNMENTS,
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.appointment_id).toBe(APPOINTMENT_ID);
  });

  it("rechaza servicios que no son JSON con el mensaje de servicios", () => {
    const result = parseUpdateAppointmentScheduleForm({
      appointment_id: APPOINTMENT_ID,
      start_time: START,
      assignments: "x",
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(result).toEqual(err("Datos de servicios invalidos."));
  });

  it("valida el id de cita con su mensaje", () => {
    const result = parseUpdateAppointmentScheduleForm({
      appointment_id: "no-uuid",
      start_time: START,
      assignments: ASSIGNMENTS,
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(result).toEqual(err("ID de cita inválido"));
  });
});

describe("parseCompleteAppointmentForm", () => {
  it("parsea el cobro y el formulario sin consultar el salon", () => {
    const result = parseCompleteAppointmentForm(completeForm());

    expect(result.ok).toBe(true);
  });

  it("si los cobros no son JSON devuelve su mensaje", () => {
    const result = parseCompleteAppointmentForm(completeForm({ item_charges: "{" }));

    expect(result).toEqual(err("Cobros de servicios invalidos."));
  });

  it("sin cobros enviados el schema exige al menos un servicio", () => {
    const result = parseCompleteAppointmentForm(completeForm({ item_charges: null }));

    expect(result).toEqual(err("La cita debe tener al menos un servicio"));
  });

  it("un metodo de pago vacio se rechaza por el schema", () => {
    const result = parseCompleteAppointmentForm(completeForm({ payment_method: "   " }));

    expect(result.ok).toBe(false);
  });

  it("devuelve el contrato ok con los datos del formulario", () => {
    const result = parseCompleteAppointmentForm(completeForm({ completion_price_note: "Propina incluida" }));

    expect(result).toEqual(
      ok(expect.objectContaining({ appointment_id: APPOINTMENT_ID, completion_price_note: "Propina incluida" }))
    );
  });
});
