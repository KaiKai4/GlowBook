import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import {
  parseConfirmReminderInput,
  parseManualReminderInput,
} from "./reminder-input";

const APPOINTMENT_ID = "00000000-0000-4000-8000-0000000000bb";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000ee";
const KEY = "5f1c2a3e-8b7d-4c6e-9a0b-1d2e3f4a5b6c";
const INVALID_ID_MESSAGE = "Identificador inválido.";
const INVALID_KEY_MESSAGE = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";

describe("parseManualReminderInput", () => {
  it("trata una plantilla vacía como ausencia de plantilla", () => {
    expect(parseManualReminderInput({ appointmentId: APPOINTMENT_ID, templateId: "", idempotencyKey: KEY })).toEqual(
      ok({ appointmentId: APPOINTMENT_ID, templateId: undefined, idempotencyKey: KEY })
    );
  });

  it("conserva una plantilla válida", () => {
    expect(
      parseManualReminderInput({ appointmentId: APPOINTMENT_ID, templateId: TEMPLATE_ID, idempotencyKey: KEY })
    ).toEqual(ok({ appointmentId: APPOINTMENT_ID, templateId: TEMPLATE_ID, idempotencyKey: KEY }));
  });

  it("rechaza una cita que no es UUID", () => {
    expect(parseManualReminderInput({ appointmentId: "x", templateId: "", idempotencyKey: KEY })).toEqual(
      err(INVALID_ID_MESSAGE)
    );
  });

  it("rechaza una plantilla no vacía con identificador inválido", () => {
    expect(parseManualReminderInput({ appointmentId: APPOINTMENT_ID, templateId: "x", idempotencyKey: KEY })).toEqual(
      err(INVALID_ID_MESSAGE)
    );
  });

  it("rechaza la clave de idempotencia ausente o mal formada", () => {
    expect(parseManualReminderInput({ appointmentId: APPOINTMENT_ID, templateId: "", idempotencyKey: "" })).toEqual(
      err(INVALID_KEY_MESSAGE)
    );
  });
});

describe("parseConfirmReminderInput", () => {
  it("valida la cita y la clave en ese orden", () => {
    expect(parseConfirmReminderInput({ appointmentId: "x", idempotencyKey: "y" })).toEqual(err(INVALID_ID_MESSAGE));
    expect(parseConfirmReminderInput({ appointmentId: APPOINTMENT_ID, idempotencyKey: "y" })).toEqual(
      err(INVALID_KEY_MESSAGE)
    );
  });

  it("devuelve los campos cuando son válidos", () => {
    expect(parseConfirmReminderInput({ appointmentId: APPOINTMENT_ID, idempotencyKey: KEY })).toEqual(
      ok({ appointmentId: APPOINTMENT_ID, idempotencyKey: KEY })
    );
  });
});
