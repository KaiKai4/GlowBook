import { describe, expect, it } from "vitest";
import { describeSalonActivity } from "./activity-messages";

const UNKNOWN_ACTIVITY_TEXT = "Registro de actividad";

describe("describeSalonActivity", () => {
  it("combina la accion con la tabla conocida", () => {
    expect(describeSalonActivity("insert", "services")).toBe("Creo un servicio");
    expect(describeSalonActivity("update", "appointments")).toBe("Actualizo una cita");
    expect(describeSalonActivity("delete", "expenses")).toBe("Elimino un gasto");
  });

  it("describe la configuracion del salon como actualizacion", () => {
    expect(describeSalonActivity("update", "salons")).toBe("Actualizo la configuración del salon");
  });

  it("usa un texto generico para una tabla desconocida", () => {
    expect(describeSalonActivity("insert", "promotions")).toBe("Creo un registro de promotions");
  });

  it("usa el texto generico cuando la accion no es conocida", () => {
    expect(describeSalonActivity("truncate", "services")).toBe(UNKNOWN_ACTIVITY_TEXT);
    expect(describeSalonActivity("", "salons")).toBe(UNKNOWN_ACTIVITY_TEXT);
  });

  it("no toma claves del prototipo como tablas ni acciones", () => {
    expect(describeSalonActivity("insert", "constructor")).toBe("Creo un registro de constructor");
    expect(describeSalonActivity("toString", "services")).toBe(UNKNOWN_ACTIVITY_TEXT);
  });
});
