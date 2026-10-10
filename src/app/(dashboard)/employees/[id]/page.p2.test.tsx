// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { getEmployeeDetail, type EmployeeDetailViewModel } from "@/features/employees/use-cases/get-employee-detail";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
import { buildProfile, SALON_ID } from "@/test/action-fixtures";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import EmployeeDetailPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/app/_composition/request-context", () => ({ requireProfile: vi.fn() }));
vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/get-employee-detail", () => ({
  getEmployeeDetail: vi.fn(),
}));
vi.mock("./delete-employee-button", () => ({
  DeleteEmployeeButton: ({ employeeName }: { employeeName: string }) => <button>Eliminar {employeeName}</button>,
}));
vi.mock("./edit-employee-modal", () => ({ EditEmployeeModal: () => <span>Editar colaborador</span> }));
vi.mock("./employee-access-panel", () => ({
  EmployeeAccessPanel: () => <section>Panel de acceso</section>,
}));
vi.mock("./work-schedule-editor", () => ({ WorkScheduleEditor: () => <section>Horario semanal</section> }));
vi.mock("./schedule-exceptions-panel", () => ({
  ScheduleExceptionsPanel: () => <section>Excepciones de agenda</section>,
}));

const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000d1";
const NOT_UUID = "colaborador-1";

function view(overrides: Partial<EmployeeDetailViewModel> = {}): EmployeeDetailViewModel {
  return {
    employee: {
      id: EMPLOYEE_ID,
      first_name: "Ana",
      last_name: "Pérez",
      phone: "+507 6000-0000",
      email: "ana@example.com",
      commission_percentage: 30,
      is_active: true,
      profile_id: null,
    },
    categories: [{ id: "cat-1", name: "Cabello" }],
    services: [{ id: "srv-1", name: "Corte" }],
    categoryOptions: [],
    schedules: [],
    scheduleExceptions: [],
    currentRoleId: null,
    pendingInvitation: null,
    roleOptions: [],
    ...overrides,
  } as unknown as EmployeeDetailViewModel;
}

describe("EmployeeDetailPage", () => {
  let mounted: MountedComponent | null = null;
  const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProfile).mockResolvedValue(manager);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(getEmployeeDetail).mockResolvedValue(view());
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("responde notFound sin consultar datos cuando el identificador no es UUID", async () => {
    await expect(EmployeeDetailPage({ params: Promise.resolve({ id: NOT_UUID }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFound).toHaveBeenCalled();
    expect(getEmployeeDetail).not.toHaveBeenCalled();
  });

  it("niega la vista sin cargar el colaborador cuando falta el permiso de gestión", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await EmployeeDetailPage({ params: Promise.resolve({ id: EMPLOYEE_ID }) }));

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar colaboradores.");
    expect(hasPermission).toHaveBeenCalledWith(manager, PERMISSIONS.EMPLOYEES_MANAGE);
    expect(getEmployeeDetail).not.toHaveBeenCalled();
  });

  it("responde notFound cuando el colaborador no existe en el salón", async () => {
    vi.mocked(getEmployeeDetail).mockResolvedValue(null);

    await expect(EmployeeDetailPage({ params: Promise.resolve({ id: EMPLOYEE_ID }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(getEmployeeDetail).toHaveBeenCalledWith({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      rolesEnabled: true,
    });
  });

  it("muestra la ficha con categorías, servicios y el panel de acceso cuando los roles están activos", async () => {
    mounted = mountComponent(await EmployeeDetailPage({ params: Promise.resolve({ id: EMPLOYEE_ID }) }));

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Ana Pérez");
    expect(text).toContain("Cabello");
    expect(text).toContain("Corte");
    expect(text).toContain("Comisión: 30%");
    expect(text).toContain("Acceso al sistema");
    expect(text).toContain("Panel de acceso");
    expect(text).toContain("Horario semanal");
    expect(text).toContain("Excepciones de agenda");
    expect(text).toContain("Eliminar Ana Pérez");
  });

  it("oculta la sección de acceso cuando el módulo de roles está deshabilitado", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    vi.mocked(getEmployeeDetail).mockResolvedValue(view());

    mounted = mountComponent(await EmployeeDetailPage({ params: Promise.resolve({ id: EMPLOYEE_ID }) }));

    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(manager, "roles");
    expect(getEmployeeDetail).toHaveBeenCalledWith(expect.objectContaining({ rolesEnabled: false }));
    expect(mounted.container.textContent).not.toContain("Acceso al sistema");
  });

  it("marca como inactivo al colaborador archivado y muestra etiquetas vacías", async () => {
    vi.mocked(getEmployeeDetail).mockResolvedValue(
      view({
        categories: [],
        services: [],
        employee: {
          id: EMPLOYEE_ID,
          first_name: "Ana",
          last_name: "Pérez",
          phone: null,
          email: null,
          commission_percentage: 0,
          is_active: false,
          profile_id: null,
        },
      } as unknown as Partial<EmployeeDetailViewModel>)
    );

    mounted = mountComponent(await EmployeeDetailPage({ params: Promise.resolve({ id: EMPLOYEE_ID }) }));

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Inactivo");
    expect(text).toContain("Sin categorías");
    expect(text).toContain("Ninguna");
    expect(text).toContain("Ninguno");
  });
});
