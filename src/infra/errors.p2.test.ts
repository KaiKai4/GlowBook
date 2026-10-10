import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import { toPublicErrorMessage } from "./errors";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const FALLBACK = "No se pudo completar la operación.";
const CONTEXT = { module: "errors", action: "public-message" };

function dbError(code: string, message: string) {
  return { code, message };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicError", () => {
  it("conserva el mensaje y el código opcional, y se identifica por nombre", () => {
    const error = new PublicError("Rol no encontrado.", { code: "ROLE_NOT_FOUND" });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PublicError);
    expect(error.message).toBe("Rol no encontrado.");
    expect(error.code).toBe("ROLE_NOT_FOUND");
    expect(error.name).toBe("PublicError");
  });

  it("sin opciones el código queda indefinido", () => {
    const error = new PublicError("Sin código.");

    expect(error.code).toBeUndefined();
    expect(error.message).toBe("Sin código.");
  });
});

describe("toPublicErrorMessage: errores de dominio", () => {
  it("devuelve el mensaje de un PublicError tal cual y no registra nada", () => {
    const message = toPublicErrorMessage(new PublicError("Los roles de sistema no se pueden eliminar."), FALLBACK);

    expect(message).toBe("Los roles de sistema no se pueden eliminar.");
    expect(captureError).not.toHaveBeenCalled();
  });
});

describe("toPublicErrorMessage: SQLSTATE mapeados", () => {
  it.each([
    ["23505", "Ya existe un registro con esos datos."],
    ["23503", "La operación hace referencia a un registro inexistente."],
    ["23P01", "Ese horario se cruza con otra cita."],
    ["22P02", "Identificador inválido."],
  ])("SQLSTATE %s devuelve el mensaje fijo sin mostrar el texto de la base", (code, expected) => {
    const message = toPublicErrorMessage(
      dbError(code, 'duplicate key value violates unique constraint "roles_salon_id_name_key"'),
      FALLBACK
    );

    expect(message).toBe(expected);
    expect(captureError).not.toHaveBeenCalled();
  });
});

describe("toPublicErrorMessage: RAISE propios (P0001, 22023, 42501)", () => {
  it.each(["P0001", "22023", "42501"])(
    "SQLSTATE %s con un mensaje de negocio seguro se muestra",
    (code) => {
      const message = toPublicErrorMessage(dbError(code, "El salón ya tiene el plan activo."), FALLBACK);

      expect(message).toBe("El salón ya tiene el plan activo.");
      expect(captureError).not.toHaveBeenCalled();
    }
  );

  it("una palabra que no es detalle interno (selection) no se confunde con SELECT", () => {
    const message = toPublicErrorMessage(dbError("P0001", "Selección de servicio no válida."), FALLBACK);

    expect(message).toBe("Selección de servicio no válida.");
  });

  it.each([
    "La función de cobro no está disponible en tu plan.",
    "Revisa la tabla de comisiones y la columna de precios.",
    "Selecciona un servicio para continuar.",
    "Stack de servicios vacío para esta categoría.",
  ])("un RAISE de negocio con palabras sueltas se muestra: %s", (rawMessage) => {
    expect(toPublicErrorMessage(dbError("P0001", rawMessage), FALLBACK)).toBe(rawMessage);
    expect(captureError).not.toHaveBeenCalled();
  });

  it.each([
    ["sentencia SELECT", "select id from appointments where salon_id = $1"],
    ["relacion con comillas", 'relation "appointments" does not exist'],
    ["columna con comillas", 'column "total_price" of relation "appointments" does not exist'],
    ["funcion con argumentos", "function recalc_appointment(uuid) failed"],
  ])("un error técnico (%s) se oculta", (_label, rawMessage) => {
    expect(toPublicErrorMessage(dbError("P0001", rawMessage), FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["detalle SQL", "syntax error at or near SELECT"],
    ["tabla", "relation public.salons does not exist"],
    ["politica RLS", "new row violates row-level security policy"],
    ["schema auth", "auth.uid() returned null"],
    ["permiso de base", "permission denied for table platform_admins"],
    ["restriccion", "violates check constraint plans_price_positive"],
    ["stack", "stack overflow en el calculo"],
    ["columna", "column appointments.total does not exist"],
    ["funcion", "function recalc_appointment() failed"],
  ])("no muestra un mensaje con %s y usa el fallback", (_label, rawMessage) => {
    const message = toPublicErrorMessage(dbError("P0001", rawMessage), FALLBACK);

    expect(message).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: rawMessage }), CONTEXT);
  });

  it("no muestra mensajes con saltos de linea", () => {
    const message = toPublicErrorMessage(dbError("22023", "Línea uno\nLínea dos"), FALLBACK);

    expect(message).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("no muestra mensajes de más de 300 caracteres", () => {
    const message = toPublicErrorMessage(dbError("P0001", "a".repeat(301)), FALLBACK);

    expect(message).toBe(FALLBACK);
  });

  it("muestra un mensaje justo en el límite de 300 caracteres", () => {
    const limit = "b".repeat(300);

    expect(toPublicErrorMessage(dbError("P0001", limit), FALLBACK)).toBe(limit);
  });

  it("un RAISE sin mensaje cae al fallback", () => {
    expect(toPublicErrorMessage(dbError("P0001", ""), FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});

describe("toPublicErrorMessage: otros errores", () => {
  it("un SQLSTATE no mapeado y no permitido usa el fallback y registra el error", () => {
    const failure = dbError("23514", "Fila inválida para la restricción");

    expect(toPublicErrorMessage(failure, FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledWith(failure, CONTEXT);
  });

  it("un codigo que no es SQLSTATE (minusculas o longitud incorrecta) se ignora", () => {
    expect(toPublicErrorMessage(dbError("p0001", "Mensaje"), FALLBACK)).toBe(FALLBACK);
    expect(toPublicErrorMessage(dbError("P00011", "Mensaje"), FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledTimes(2);
  });

  it("un código que no es texto se ignora", () => {
    expect(toPublicErrorMessage({ code: 23505, message: "x" }, FALLBACK)).toBe(FALLBACK);
  });

  it("un Error normal (red, JS) usa el fallback sin filtrar su texto", () => {
    const failure = new Error("fetch failed: ECONNRESET");

    expect(toPublicErrorMessage(failure, FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledWith(failure, CONTEXT);
  });

  it.each([
    ["una cadena", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["un número", 42],
  ])("un valor no-objeto (%s) usa el fallback", (_label, value) => {
    expect(toPublicErrorMessage(value, FALLBACK)).toBe(FALLBACK);
    expect(captureError).toHaveBeenCalledWith(value, CONTEXT);
  });

  it("un objeto sin campo message devuelve el fallback", () => {
    expect(toPublicErrorMessage({ code: "P0001" }, FALLBACK)).toBe(FALLBACK);
  });
});
