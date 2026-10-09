import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { getAssignableRoleOptions } from "@/features/access/use-cases/role-options";
import { getCategoryServiceOptions } from "@/features/services/use-cases/category-service-options";
import { findEmployeeAccessProfile } from "../data/employee-access.repo";
import { findUpcomingEmployeeExceptions } from "../data/employee-exceptions.repo";
import { findEmployeeById, findLatestEmployeeInvitation } from "../data/employees.repo";
import { getEmployeeDetail } from "./get-employee-detail";

// Ramas de la ficha del colaborador que el test principal no recorre: fallos de
// lectura del rol, invitaciones vencidas o aceptadas, relaciones vacías y
// feature de roles desactivada.

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
  findLatestEmployeeInvitation: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  findEmployeeAccessProfile: vi.fn(),
}));

vi.mock("../data/employee-exceptions.repo", () => ({
  findUpcomingEmployeeExceptions: vi.fn(),
}));

vi.mock("@/features/services/use-cases/category-service-options", () => ({
  getCategoryServiceOptions: vi.fn(),
}));

vi.mock("@/features/access/use-cases/role-options", () => ({
  getAssignableRoleOptions: vi.fn(),
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const NOW = new Date("2026-10-09T12:00:00.000Z");

const mockedCaptureError = vi.mocked(captureError);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedFindLatestInvitation = vi.mocked(findLatestEmployeeInvitation);
const mockedFindAccessProfile = vi.mocked(findEmployeeAccessProfile);
const mockedFindExceptions = vi.mocked(findUpcomingEmployeeExceptions);
const mockedCategoryOptions = vi.mocked(getCategoryServiceOptions);
const mockedRoleOptions = vi.mocked(getAssignableRoleOptions);

const employeeWithoutAccess = {
  id: EMPLOYEE_ID,
  first_name: "Ana",
  last_name: "Vega",
  phone: "099",
  email: "ana@example.com",
  specialty: "Color",
  commission_percentage: 10,
  profile_id: null,
  is_active: true,
  services: [],
  categories: [],
  work_schedules: [],
};

describe("get employee detail branches", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeById.mockResolvedValue(employeeWithoutAccess as never);
    mockedFindLatestInvitation.mockResolvedValue(null);
    mockedFindAccessProfile.mockResolvedValue({ data: null, error: null });
    mockedFindExceptions.mockResolvedValue([]);
    mockedCategoryOptions.mockResolvedValue([]);
    mockedRoleOptions.mockResolvedValue([]);
  });

  it("devuelve null si el colaborador no existe en el salón", async () => {
    mockedFindEmployeeById.mockResolvedValue(null as never);

    await expect(
      getEmployeeDetail({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, rolesEnabled: true })
    ).resolves.toBeNull();

    expect(mockedFindLatestInvitation).not.toHaveBeenCalled();
    expect(mockedFindExceptions).not.toHaveBeenCalled();
  });

  it("no consulta roles cuando la feature está desactivada y deja roleOptions vacío", async () => {
    mockedRoleOptions.mockResolvedValue([{ id: "role-1", name: "Caja" }]);

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
    });

    expect(mockedRoleOptions).not.toHaveBeenCalled();
    expect(detail?.roleOptions).toEqual([]);
  });

  it("consulta roles asignables del salón cuando la feature está activa", async () => {
    mockedRoleOptions.mockResolvedValue([{ id: "role-1", name: "Caja" }]);

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: true,
    });

    expect(mockedRoleOptions).toHaveBeenCalledWith(SALON_ID);
    expect(detail?.roleOptions).toEqual([{ id: "role-1", name: "Caja" }]);
  });

  it("convierte valores nulos de texto a cadenas vacías y la comisión a número", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      ...employeeWithoutAccess,
      phone: null,
      email: null,
      specialty: null,
      commission_percentage: null,
    } as never);

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
    });

    expect(detail?.employee).toEqual({
      id: EMPLOYEE_ID,
      first_name: "Ana",
      last_name: "Vega",
      phone: "",
      email: "",
      specialty: "",
      commission_percentage: 0,
      profile_id: null,
      is_active: true,
    });
  });

  it("muestra el rol actual de la cuenta vinculada", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      ...employeeWithoutAccess,
      profile_id: "profile-1",
    } as never);
    mockedFindAccessProfile.mockResolvedValue({
      data: { role_id: "role-1", is_owner: false },
      error: null,
    });

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
      now: NOW,
    });

    expect(mockedFindAccessProfile).toHaveBeenCalledWith("profile-1", SALON_ID);
    expect(detail?.currentRoleId).toBe("role-1");
  });

  it("si falla la lectura del perfil registra el error y no muestra rol", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      ...employeeWithoutAccess,
      profile_id: "profile-1",
    } as never);
    mockedFindAccessProfile.mockResolvedValue({ data: null, error: { message: "caido" } });

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
    });

    expect(detail?.currentRoleId).toBeNull();
    expect(mockedCaptureError).toHaveBeenCalledWith(
      { message: "caido" },
      { module: "employees", action: "detail" }
    );
  });

  it("muestra la invitación pendiente vigente cuando el colaborador no tiene cuenta", async () => {
    mockedFindLatestInvitation.mockResolvedValue({
      id: "inv-1",
      email: "ana@example.com",
      role_id: "role-2",
      expires_at: "2026-10-16T00:00:00.000Z",
      accepted_at: null,
    });

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
      now: NOW,
    });

    expect(mockedFindLatestInvitation).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
    expect(detail?.pendingInvitation).toEqual({
      expiresAt: "2026-10-16T00:00:00.000Z",
      roleId: "role-2",
    });
  });

  it("oculta una invitación ya vencida respecto a la fecha indicada", async () => {
    mockedFindLatestInvitation.mockResolvedValue({
      id: "inv-1",
      email: "ana@example.com",
      role_id: null,
      expires_at: "2026-10-08T00:00:00.000Z",
      accepted_at: null,
    });

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
      now: NOW,
    });

    expect(detail?.pendingInvitation).toBeNull();
  });

  it("oculta una invitación ya aceptada aunque siga vigente en fecha", async () => {
    mockedFindLatestInvitation.mockResolvedValue({
      id: "inv-1",
      email: "ana@example.com",
      role_id: null,
      expires_at: "2026-10-16T00:00:00.000Z",
      accepted_at: "2026-10-01T00:00:00.000Z",
    });

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
      now: NOW,
    });

    expect(detail?.pendingInvitation).toBeNull();
  });

  it("no busca invitaciones si el colaborador ya tiene cuenta vinculada", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      ...employeeWithoutAccess,
      profile_id: "profile-1",
    } as never);

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
    });

    expect(mockedFindLatestInvitation).not.toHaveBeenCalled();
    expect(detail?.pendingInvitation).toBeNull();
  });

  it("filtra servicios y categorías sin referencia y mapea horarios y días libres", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      ...employeeWithoutAccess,
      services: [
        { service: { id: "s1", name: "Corte" } },
        { service: null },
      ],
      categories: [
        { category: { id: "c1", name: "Cabello" } },
        { category: null },
      ],
      work_schedules: [
        { id: "ws-1", day_of_week: 2, start_time: "10:00", end_time: "12:00", is_active: true },
      ],
    } as never);
    mockedFindExceptions.mockResolvedValue([
      { id: "ex-1", exception_date: "2026-10-20", reason: "Cita médica" },
    ]);

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
    });

    expect(detail?.services).toEqual([{ id: "s1", name: "Corte" }]);
    expect(detail?.categories).toEqual([{ id: "c1", name: "Cabello" }]);
    expect(detail?.schedules).toEqual([
      { id: "ws-1", day_of_week: 2, start_time: "10:00", end_time: "12:00" },
    ]);
    expect(detail?.scheduleExceptions).toEqual([
      { id: "ex-1", date: "2026-10-20", reason: "Cita médica" },
    ]);
    expect(mockedFindExceptions).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
  });

  it("entrega las opciones de categorías del salón tal cual", async () => {
    const categories = [
      { id: "c1", name: "Cabello", services: [{ id: "s1", name: "Corte" }] },
    ];
    mockedCategoryOptions.mockResolvedValue(categories);

    const detail = await getEmployeeDetail({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: false,
    });

    expect(mockedCategoryOptions).toHaveBeenCalledWith(SALON_ID);
    expect(detail?.categoryOptions).toEqual(categories);
  });
});
