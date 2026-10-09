import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "./public-error";
import { toPublicErrorMessage } from "./errors";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const FALLBACK = "No se pudo completar la operación.";

function pgError(code: string, message: string) {
  return { code, message, details: null, hint: null };
}

describe("toPublicErrorMessage", () => {
  beforeEach(() => {
    vi.mocked(captureError).mockClear();
  });

  it("returns the message of a PublicError without capturing it", () => {
    const error = new PublicError("El cliente ya está archivado.", { code: "archived" });

    expect(toPublicErrorMessage(error, FALLBACK)).toBe("El cliente ya está archivado.");
    expect(captureError).not.toHaveBeenCalled();
  });

  it.each([
    ["23505", "Ya existe un registro con esos datos."],
    ["23503", "La operación hace referencia a un registro inexistente."],
    ["23P01", "Ese horario se cruza con otra cita."],
    ["22P02", "Identificador inválido."],
  ])("maps SQLSTATE %s to a fixed Spanish message", (code, expected) => {
    const error = pgError(code, 'duplicate key value violates unique constraint "customers_phone_key"');

    expect(toPublicErrorMessage(error, FALLBACK)).toBe(expected);
    expect(captureError).not.toHaveBeenCalled();
  });

  it.each([
    ["P0001", "Solo puedes cancelar una cita pendiente."],
    ["22023", "Rango de fechas inválido."],
    ["42501", "No tienes permiso para realizar esta acción."],
  ])("passes through our own RAISE message for SQLSTATE %s", (code, message) => {
    expect(toPublicErrorMessage(pgError(code, message), FALLBACK)).toBe(message);
  });

  it.each([
    ["42501", 'new row violates row-level security policy for table "appointments"'],
    ["P0001", 'permission denied for table "salons"'],
    ["22023", 'syntax error at or near "SELECT"'],
    ["P0001", "Error en public.appointments: fallo interno"],
    ["P0001", "línea uno\nlínea dos"],
  ])("never leaks database internals for %s (%s)", (code, message) => {
    expect(toPublicErrorMessage(pgError(code, message), FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("never leaks a message longer than the public limit", () => {
    const long = "a".repeat(301);

    expect(toPublicErrorMessage(pgError("P0001", long), FALLBACK)).toBe(FALLBACK);
  });

  it("falls back and captures generic Error instances with their SQL-like message", () => {
    const error = new Error("select * from appointments where id = $1");

    expect(toPublicErrorMessage(error, FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledWith(error, {
      module: "errors",
      action: "public-message",
    });
  });

  it("falls back and captures network-like failures", () => {
    const error = { code: "ECONNRESET", message: "socket hang up" };

    expect(toPublicErrorMessage(error, FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("falls back for unknown values (strings, null, undefined)", () => {
    expect(toPublicErrorMessage("boom", FALLBACK)).toBe(FALLBACK);
    expect(toPublicErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(toPublicErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(3);
  });

  it("falls back when a passthrough SQLSTATE has an empty message", () => {
    expect(toPublicErrorMessage(pgError("P0001", ""), FALLBACK)).toBe(FALLBACK);
  });
});
