import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "@/infra/result";
import {
  changeEmployeeRole,
  createEmployeeInviteForExistingEmployee,
  resetEmployeeAccess,
} from "./employee-access";
import {
  changeEmployeeRoleFlow,
  generateEmployeeInviteFlow,
  resetEmployeeAccessFlow,
} from "./employee-role-flows";

const ROLES_DISABLED_MESSAGE = "Los roles estan deshabilitados para este salon.";

vi.mock("./employee-access", () => ({
  changeEmployeeRole: vi.fn(),
  createEmployeeInviteForExistingEmployee: vi.fn(),
  resetEmployeeAccess: vi.fn(),
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "emp-1";
const ROLE_ID = "role-1";
const INVITE = { token: "tok", expiresAt: "2026-10-10T00:00:00.000Z" };
const DISABLED = err(ROLES_DISABLED_MESSAGE);
const gate = { salonId: SALON_ID, rolesEnabled: true };
const disabledGate = { salonId: SALON_ID, rolesEnabled: false };

describe("changeEmployeeRoleFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no toca el caso de uso si los roles estan deshabilitados", async () => {
    expect(await changeEmployeeRoleFlow(disabledGate, { profileId: EMPLOYEE_ID, roleId: ROLE_ID })).toEqual(DISABLED);
    expect(changeEmployeeRole).not.toHaveBeenCalled();
  });

  it("cambia el rol con el salon de la sesion", async () => {
    vi.mocked(changeEmployeeRole).mockResolvedValue(ok(undefined));

    expect(await changeEmployeeRoleFlow(gate, { profileId: EMPLOYEE_ID, roleId: null })).toEqual(ok(undefined));
    expect(changeEmployeeRole).toHaveBeenCalledWith(SALON_ID, EMPLOYEE_ID, null);
  });
});

describe("resetEmployeeAccessFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no genera el enlace si los roles estan deshabilitados", async () => {
    expect(await resetEmployeeAccessFlow(disabledGate, { employeeId: EMPLOYEE_ID, roleId: null })).toEqual(DISABLED);
    expect(resetEmployeeAccess).not.toHaveBeenCalled();
  });

  it("normaliza el rol vacio a null y devuelve el enlace", async () => {
    vi.mocked(resetEmployeeAccess).mockResolvedValue(ok(INVITE));

    expect(await resetEmployeeAccessFlow(gate, { employeeId: EMPLOYEE_ID, roleId: "" })).toEqual(ok(INVITE));
    expect(resetEmployeeAccess).toHaveBeenCalledWith({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });
  });

  it("propaga el error del caso de uso", async () => {
    vi.mocked(resetEmployeeAccess).mockResolvedValue(err("El colaborador no tiene email."));

    expect(await resetEmployeeAccessFlow(gate, { employeeId: EMPLOYEE_ID, roleId: ROLE_ID })).toEqual(
      err("El colaborador no tiene email.")
    );
  });
});

describe("generateEmployeeInviteFlow", () => {
  const checkLoginLimit = vi.fn<() => Promise<Result<void>>>(async () => ok(undefined));

  beforeEach(() => {
    vi.clearAllMocks();
    checkLoginLimit.mockResolvedValue(ok(undefined));
  });

  it("no consulta el cupo de login si los roles estan deshabilitados", async () => {
    const result = await generateEmployeeInviteFlow(
      { ...disabledGate, checkLoginLimit },
      { employeeId: EMPLOYEE_ID, roleId: ROLE_ID }
    );

    expect(result).toEqual(DISABLED);
    expect(checkLoginLimit).not.toHaveBeenCalled();
    expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
  });

  it("corta con el error del cupo de login sin crear la invitacion", async () => {
    checkLoginLimit.mockResolvedValue(err("Sin cupo de usuarios con acceso."));

    expect(
      await generateEmployeeInviteFlow({ ...gate, checkLoginLimit }, { employeeId: EMPLOYEE_ID, roleId: ROLE_ID })
    ).toEqual(err("Sin cupo de usuarios con acceso."));
    expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
  });

  it("crea la invitacion tras el cupo y devuelve su resultado", async () => {
    vi.mocked(createEmployeeInviteForExistingEmployee).mockResolvedValue(ok(INVITE));

    expect(
      await generateEmployeeInviteFlow({ ...gate, checkLoginLimit }, { employeeId: EMPLOYEE_ID, roleId: null })
    ).toEqual(ok(INVITE));
    expect(createEmployeeInviteForExistingEmployee).toHaveBeenCalledWith({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      roleId: null,
    });
  });
});
