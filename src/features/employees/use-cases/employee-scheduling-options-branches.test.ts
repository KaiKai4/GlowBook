import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveEmployeeNames, findEmployees } from "../data/employees-read.repo";
import { getEmployeeCalendarOptions } from "./employee-calendar-options";
import { getEmployeeSchedulingOptions } from "./employee-scheduling-options";

// Opciones que alimentan la agenda y el calendario: solo colaboradores activos,
// servicios inactivos fuera cuando se conoce el catálogo activo, y referencias
// vacías ignoradas sin romper el mapeo.

vi.mock("../data/employees-read.repo", () => ({
  findActiveEmployeeNames: vi.fn(),
  findEmployees: vi.fn(),
}));

const SALON_ID = "salon-1";
const mockedFindEmployees = vi.mocked(findEmployees);
const mockedFindActiveNames = vi.mocked(findActiveEmployeeNames);

describe("employee scheduling options branches", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("pide solo colaboradores activos del salón", async () => {
    mockedFindEmployees.mockResolvedValue([]);

    await getEmployeeSchedulingOptions(SALON_ID);

    expect(mockedFindEmployees).toHaveBeenCalledWith(SALON_ID, true);
  });

  it("sin catálogo activo conserva todos los servicios asignados con id", async () => {
    mockedFindEmployees.mockResolvedValue([
      {
        id: "e1",
        first_name: "Ana",
        last_name: "Vega",
        services: [
          { service: { id: "s1" } },
          { service: { id: "s2" } },
          { service: null },
        ],
        categories: [],
        work_schedules: [],
      },
    ] as never);

    const [option] = await getEmployeeSchedulingOptions(SALON_ID);

    expect(option?.service_ids).toEqual(["s1", "s2"]);
  });

  it("con catálogo activo descarta los servicios que ya no están activos", async () => {
    mockedFindEmployees.mockResolvedValue([
      {
        id: "e1",
        first_name: "Ana",
        last_name: "Vega",
        services: [{ service: { id: "s1" } }, { service: { id: "s-archivado" } }],
        categories: [],
        work_schedules: [],
      },
    ] as never);

    const [option] = await getEmployeeSchedulingOptions(SALON_ID, new Set(["s1"]));

    expect(option?.service_ids).toEqual(["s1"]);
  });

  it("ignora categorías sin referencia y mapea los horarios activos e inactivos", async () => {
    mockedFindEmployees.mockResolvedValue([
      {
        id: "e1",
        first_name: "Ana",
        last_name: "  ",
        services: [],
        categories: [{ category: { id: "c1" } }, { category: null }],
        work_schedules: [
          { id: "ws-1", day_of_week: 0, start_time: "09:00", end_time: "12:00", is_active: false },
        ],
      },
    ] as never);

    const [option] = await getEmployeeSchedulingOptions(SALON_ID);

    expect(option).toEqual({
      id: "e1",
      name: "Ana",
      service_ids: [],
      category_ids: ["c1"],
      work_schedules: [
        { day_of_week: 0, start_time: "09:00", end_time: "12:00", is_active: false },
      ],
    });
  });

  it("acepta colaboradores sin relaciones cargadas", async () => {
    mockedFindEmployees.mockResolvedValue([
      {
        id: "e2",
        first_name: "Luis",
        last_name: "Pérez",
        services: null,
        categories: null,
        work_schedules: null,
      },
    ] as never);

    await expect(getEmployeeSchedulingOptions(SALON_ID)).resolves.toEqual([
      {
        id: "e2",
        name: "Luis Pérez",
        service_ids: [],
        category_ids: [],
        work_schedules: [],
      },
    ]);
  });
});

describe("employee calendar options", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devuelve los nombres de colaboradores activos del salón tal cual", async () => {
    const names = [{ id: "e1", first_name: "Ana", last_name: "Vega" }];
    mockedFindActiveNames.mockResolvedValue(names);

    await expect(getEmployeeCalendarOptions(SALON_ID)).resolves.toEqual(names);
    expect(mockedFindActiveNames).toHaveBeenCalledWith(SALON_ID);
  });
});
