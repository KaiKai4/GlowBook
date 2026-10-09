import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonActivity, type ActivityLogRow } from "../data/activity-log.repo";
import { getSalonActivity } from "./get-salon-activity";

vi.mock("../data/activity-log.repo", () => ({
  findSalonActivity: vi.fn(),
}));

const mockedFindSalonActivity = vi.mocked(findSalonActivity);

function activityRow(overrides: Partial<ActivityLogRow>): ActivityLogRow {
  return {
    id: "log-1",
    actor_id: "user-1",
    actor_email: "dueno@example.com",
    table_name: "appointments",
    action: "insert",
    record_id: "rec-1",
    record_label: "Cita de Ana",
    // Mediodia UTC: la fecha local sigue siendo 12 de junio en casi cualquier zona.
    created_at: "2026-06-12T12:00:00.000Z",
    ...overrides,
  };
}

describe("getSalonActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("describe cada accion con la verbo y el sujeto del tipo de registro", async () => {
    mockedFindSalonActivity.mockResolvedValue([
      activityRow({ id: "1", action: "insert", table_name: "appointments" }),
      activityRow({ id: "2", action: "update", table_name: "customers" }),
      activityRow({ id: "3", action: "delete", table_name: "expenses" }),
      activityRow({ id: "4", action: "update", table_name: "inventory_movements" }),
      activityRow({ id: "5", action: "insert", table_name: "tabla_desconocida" }),
    ]);

    const view = await getSalonActivity();

    expect(view.entries.map((entry) => entry.actionLabel)).toEqual([
      "Creo una cita",
      "Actualizo un cliente",
      "Elimino un gasto",
      "Actualizo un movimiento de inventario",
      "Creo un registro de tabla_desconocida",
    ]);
  });

  it("describe los cambios de configuracion del salon con una frase propia", async () => {
    mockedFindSalonActivity.mockResolvedValue([activityRow({ action: "update", table_name: "salons" })]);

    const [entry] = (await getSalonActivity()).entries;

    expect(entry?.actionLabel).toBe("Actualizo la configuración del salon");
  });

  it("mapea los campos de presentacion y usa 'sistema' cuando no hay correo del actor", async () => {
    mockedFindSalonActivity.mockResolvedValue([
      activityRow({ id: "a", actor_email: "", record_label: "Gasto de luz" }),
      activityRow({ id: "b", actor_email: "ana@example.com", record_label: "Venta" }),
    ]);

    const view = await getSalonActivity();

    expect(view.entries[0]).toMatchObject({
      id: "a",
      actorEmail: "sistema",
      recordLabel: "Gasto de luz",
    });
    expect(view.entries[1]?.actorEmail).toBe("ana@example.com");
  });

  it("formatea fecha y hora en espanol a partir de la marca de creacion", async () => {
    mockedFindSalonActivity.mockResolvedValue([activityRow({})]);

    const [entry] = (await getSalonActivity()).entries;

    expect(entry?.dateLabel).toContain("2026");
    expect(entry?.dateLabel).toContain("junio");
    expect(entry?.timeLabel).toMatch(/\d{2}:\d{2}/);
  });

  it("devuelve una vista vacia cuando no hay actividad", async () => {
    mockedFindSalonActivity.mockResolvedValue([]);

    expect(await getSalonActivity()).toEqual({ entries: [] });
  });
});
