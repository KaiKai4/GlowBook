import { describe, expect, it } from "vitest";
import { parseCreateAppointmentForm } from "./parse-appointment-input";

const CUSTOMER_ID = "00000000-0000-4000-8000-0000000000a1";
const KEY = "00000000-0000-4000-8000-0000000000c3";
const SERVICE = "00000000-0000-4000-8000-0000000000d4";
const EMPLOYEE = "00000000-0000-4000-8000-0000000000e5";
const ASSIGNMENTS = JSON.stringify([{ service_id: SERVICE, employee_id: EMPLOYEE }]);
const BASE = {
  start_time: "2030-01-07T15:00:00.000Z",
  notes: "",
  assignments: ASSIGNMENTS,
  idempotency_key: KEY,
};
const NEW_CUSTOMER = JSON.stringify({ first_name: " Luis ", last_name: "Soto", phone: "+50761112233" });
const BOTH_OR_NONE = "Indica un cliente existente o un cliente nuevo, no ambos ni ninguno.";

describe("parseCreateAppointmentForm con cliente nuevo", () => {
  it("acepta new_customer en lugar de customer_id y normaliza los nombres", () => {
    const result = parseCreateAppointmentForm({ ...BASE, new_customer: NEW_CUSTOMER });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.new_customer).toEqual({ first_name: "Luis", last_name: "Soto", phone: "+50761112233" });
    expect(result.value.customer_id).toBeUndefined();
  });

  it("acepta un cliente nuevo sin teléfono", () => {
    const result = parseCreateAppointmentForm({
      ...BASE,
      new_customer: JSON.stringify({ first_name: "Ana", last_name: "Ruiz" }),
    });

    expect(result.ok).toBe(true);
  });

  it("rechaza customer_id y new_customer a la vez", () => {
    expect(parseCreateAppointmentForm({ ...BASE, customer_id: CUSTOMER_ID, new_customer: NEW_CUSTOMER })).toEqual({
      ok: false,
      error: BOTH_OR_NONE,
    });
  });

  it("rechaza no indicar cliente", () => {
    expect(parseCreateAppointmentForm({ ...BASE })).toEqual({ ok: false, error: BOTH_OR_NONE });
  });

  it("rechaza un cliente nuevo sin nombre", () => {
    const result = parseCreateAppointmentForm({
      ...BASE,
      new_customer: JSON.stringify({ first_name: "   ", last_name: "Soto" }),
    });

    expect(result.ok).toBe(false);
  });

  it("rechaza un teléfono inválido en el cliente nuevo", () => {
    const result = parseCreateAppointmentForm({
      ...BASE,
      new_customer: JSON.stringify({ first_name: "Ana", last_name: "Ruiz", phone: "2123-4567" }),
    });

    expect(result.ok).toBe(false);
  });
});
