import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "@/infra/result";
import { changeEmployeeRole } from "./employee-role";
import { createEmployeeInviteForExistingEmployee } from "./employee-invitation-issue";
import { resetEmployeeAccess } from "./employee-revocation";
import {
  changeEmployeeRoleWithGate,
  generateEmployeeInvite,
  resetEmployeeAccessWithGate,
} from "./employee-role-commands";

const ROLES_DISABLED_MESSAGE = "Los roles están deshabilitados para este salón.";

vi.mock("./employee-role", () => ({
  changeEmployeeRole: vi.fn(),
}));

vi.mock("./employee-invitation-issue", () => ({
  createEmployeeInviteForExistingEmployee: vi.fn(),
}));

vi.mock("./employee-revocation", () => ({
  resetEmployeeAccess: vi.fn(),
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "emp-1";
const ROLE_ID = "role-1";
const INVITE = { token: "tok", expiresAt: "2026-10-10T00:00:00.000Z" };
const DISABLED = err(ROLES_DISABLED_MESSAGE);
const gate = { salonId: SALON_ID, rolesEnabled: true };
const disabledGate = { salonId: SALON_ID, rolesEnabled: false };

describe("changeEmployeeRoleWithGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no toca el caso de uso si los roles están deshabilitados", async () => {
    expect(await changeEmployeeRoleWithGate(disabledGate, { profileId: EMPLOYEE_ID, roleId: ROLE_ID })).toEqual(DISABLED);
    expect(changeEmployeeRole).not.toHaveBeenCalled();
  });

  it("cambia el rol con el salón de la sesión", async () => {
    vi.mocked(changeEmployeeRole).mockResolvedValue(ok(undefined));

    expect(await changeEmployeeRoleWithGate(gate, { profileId: EMPLOYEE_ID, roleId: null })).toEqual(ok(undefined));
    expect(changeEmployeeRole).toHaveBeenCalledWith(SALON_ID, EMPLOYEE_ID, null);
  });
});

describe("resetEmployeeAccessWithGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no genera el enlace si los roles están deshabilitados", async () => {
    expect(await resetEmployeeAccessWithGate(disabledGate, { employeeId: EMPLOYEE_ID, roleId: null })).toEqual(DISABLED);
    expect(resetEmployeeAccess).not.toHaveBeenCalled();
  });

  it("normaliza el rol vacio a null y devuelve el enlace", async () => {
    vi.mocked(resetEmployeeAccess).mockResolvedValue(ok(INVITE));

    expect(await resetEmployeeAccessWithGate(gate, { employeeId: EMPLOYEE_ID, roleId: "" })).toEqual(ok(INVITE));
    expect(resetEmployeeAccess).toHaveBeenCalledWith({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });
  });

  it("propaga el error del caso de uso", async () => {
    vi.mocked(resetEmployeeAccess).mockResolvedValue(err("El colaborador no tiene email."));

    expect(await resetEmployeeAccessWithGate(gate, { employeeId: EMPLOYEE_ID, roleId: ROLE_ID })).toEqual(
      err("El colaborador no tiene email.")
    );
  });
});

describe("generateEmployeeInvite", () => {
  const checkLoginLimit = vi.fn<() => Promise<Result<void>>>(async () => ok(undefined));

  beforeEach(() => {
    vi.clearAllMocks();
    checkLoginLimit.mockResolvedValue(ok(undefined));
  });

  it("no consulta el cupo de login si los roles están deshabilitados", async () => {
    const result = await generateEmployeeInvite(
      { ...disabledGate, checkLoginLimit },
      { employeeId: EMPLOYEE_ID, roleId: ROLE_ID }
    );

    expect(result).toEqual(DISABLED);
    expect(checkLoginLimit).not.toHaveBeenCalled();
    expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
  });

  it("corta con el error del cupo de login sin crear la invitación", async () => {
    checkLoginLimit.mockResolvedValue(err("Sin cupo de usuarios con acceso."));

    expect(
      await generateEmployeeInvite({ ...gate, checkLoginLimit }, { employeeId: EMPLOYEE_ID, roleId: ROLE_ID })
    ).toEqual(err("Sin cupo de usuarios con acceso."));
    expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
  });

  it("crea la invitación tras el cupo y devuelve su resultado", async () => {
    vi.mocked(createEmployeeInviteForExistingEmployee).mockResolvedValue(ok(INVITE));

    expect(
      await generateEmployeeInvite({ ...gate, checkLoginLimit }, { employeeId: EMPLOYEE_ID, roleId: null })
    ).toEqual(ok(INVITE));
    expect(createEmployeeInviteForExistingEmployee).toHaveBeenCalledWith({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      roleId: null,
    });
  });
});
