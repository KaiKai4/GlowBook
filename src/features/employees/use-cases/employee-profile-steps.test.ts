import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import type { findEmployeeByEmail } from "@/features/employees/data/employees-read.repo";
import { err, ok } from "@/infra/result";
import type { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import type { replacePendingEmployeeInvitation } from "./employee-invitation-issue";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";
import {
  checkAccessBeforeUnlink,
  findArchivedEmployeeByEmail,
  inviteEmployeeAccess,
  revokeAuthAccountAfterUnlink,
  type ArchivedLookupDeps,
  type InviteAccessDeps,
  type RevokeAccessDeps,
} from "./employee-profile-steps";

// Pasos del alta y la edicion de perfil. Cada paso se prueba con fakes tipados de
// sus propias dependencias, sin tocar la base de datos ni Auth.

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const PROFILE_ID = "profile-1";

const findEmployeeByEmailFake = vi.fn<typeof findEmployeeByEmail>();
const archivedDeps: ArchivedLookupDeps = { findEmployeeByEmail: findEmployeeByEmailFake };

const replaceInviteFake = vi.fn<typeof replacePendingEmployeeInvitation>();
const inviteDeps: InviteAccessDeps = { replacePendingInvitation: replaceInviteFake };

const checkRevocableFake = vi.fn<typeof checkEmployeeAccessRevocable>();
const deleteAuthFake = vi.fn<typeof deleteEmployeeAuthAccount>();
const revokeDeps: RevokeAccessDeps = {
  checkEmployeeAccessRevocable: checkRevocableFake,
  deleteEmployeeAuthAccount: deleteAuthFake,
};

function employeeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: EMPLOYEE_ID,
    salon_id: SALON_ID,
    profile_id: null,
    first_name: "Ana",
    last_name: "Lopez",
    phone: "600111",
    email: "ana@glowbook.test",
    specialty: "Color",
    commission_percentage: 25,
    hire_date: null,
    is_active: true,
    created_at: "2030-01-01T00:00:00Z",
    updated_at: "2030-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("findArchivedEmployeeByEmail", () => {
  it("devuelve el colaborador archivado con ese email", async () => {
    findEmployeeByEmailFake.mockResolvedValue(employeeRow({ is_active: false, first_name: "Ana", last_name: "Lopez" }));

    await expect(findArchivedEmployeeByEmail(SALON_ID, " ana@glowbook.test ", archivedDeps)).resolves.toEqual({
      id: EMPLOYEE_ID,
      name: "Ana Lopez",
      email: "ana@glowbook.test",
    });
    expect(findEmployeeByEmailFake).toHaveBeenCalledWith("ana@glowbook.test", SALON_ID);
  });

  it("no devuelve colaboradores activos ni emails vacios", async () => {
    findEmployeeByEmailFake.mockResolvedValue(employeeRow({ is_active: true }));
    await expect(findArchivedEmployeeByEmail(SALON_ID, "ana@glowbook.test", archivedDeps)).resolves.toBeNull();
    await expect(findArchivedEmployeeByEmail(SALON_ID, "   ", archivedDeps)).resolves.toBeNull();
    expect(findEmployeeByEmailFake).toHaveBeenCalledTimes(1);
  });

  it("no devuelve nada si no hay coincidencia", async () => {
    findEmployeeByEmailFake.mockResolvedValue(null);

    await expect(findArchivedEmployeeByEmail(SALON_ID, "nadie@glowbook.test", archivedDeps)).resolves.toBeNull();
  });
});

describe("inviteEmployeeAccess", () => {
  it("delega la sustitucion de la invitacion pendiente con la entrada recibida", async () => {
    const expiresAt = "2030-01-08T00:00:00Z";
    replaceInviteFake.mockResolvedValue(ok({ token: "tok", expiresAt }));

    const input = { employeeId: EMPLOYEE_ID, salonId: SALON_ID, email: "ana@glowbook.test", roleId: "role-1" };
    await expect(inviteEmployeeAccess(input, inviteDeps)).resolves.toEqual({
      ok: true,
      value: { token: "tok", expiresAt },
    });
    expect(replaceInviteFake).toHaveBeenCalledWith(input);
  });

  it("propaga el error de la invitacion sin reintentar", async () => {
    replaceInviteFake.mockResolvedValue(err("No se pudo generar el nuevo enlace de acceso."));

    await expect(
      inviteEmployeeAccess(
        { employeeId: EMPLOYEE_ID, salonId: SALON_ID, email: "ana@glowbook.test", roleId: null },
        inviteDeps
      )
    ).resolves.toEqual({ ok: false, error: "No se pudo generar el nuevo enlace de acceso." });
    expect(replaceInviteFake).toHaveBeenCalledTimes(1);
  });
});

describe("checkAccessBeforeUnlink", () => {
  it("devuelve el rol del perfil vinculado sin escribir ni borrar cuentas", async () => {
    checkRevocableFake.mockResolvedValue(ok({ roleId: "role-1" }));

    await expect(checkAccessBeforeUnlink(PROFILE_ID, SALON_ID, revokeDeps)).resolves.toEqual({
      ok: true,
      value: { roleId: "role-1" },
    });
    expect(checkRevocableFake).toHaveBeenCalledWith(PROFILE_ID, SALON_ID);
    expect(deleteAuthFake).not.toHaveBeenCalled();
  });

  it("propaga el rechazo del perfil (owner o no encontrado)", async () => {
    checkRevocableFake.mockResolvedValue(err("No se puede modificar el acceso de un owner desde colaboradores."));

    await expect(checkAccessBeforeUnlink(PROFILE_ID, SALON_ID, revokeDeps)).resolves.toEqual({
      ok: false,
      error: "No se puede modificar el acceso de un owner desde colaboradores.",
    });
  });
});

describe("revokeAuthAccountAfterUnlink", () => {
  it("no devuelve avisos cuando la cuenta de Auth se borra", async () => {
    deleteAuthFake.mockResolvedValue(ok(undefined));

    await expect(revokeAuthAccountAfterUnlink(PROFILE_ID, revokeDeps)).resolves.toEqual([]);
    expect(deleteAuthFake).toHaveBeenCalledWith(PROFILE_ID);
  });

  it("devuelve el aviso de cuenta anterior si Auth falla, sin lanzar", async () => {
    deleteAuthFake.mockResolvedValue(err("No se pudo revocar la cuenta anterior del colaborador."));

    await expect(revokeAuthAccountAfterUnlink(PROFILE_ID, revokeDeps)).resolves.toEqual([
      OLD_ACCOUNT_NOT_DELETED_WARNING,
    ]);
  });
});
