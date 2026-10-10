"use server";

import { defineAction } from "@/app/_composition/define-action";
import {
  changeEmployeeRoleFlow,
  generateEmployeeInviteFlow,
  resetEmployeeAccessFlow,
} from "@/features/employees";
import type { Result } from "@/infra/result";
import {
  checkIds,
  EMPLOYEE_GUARD,
  loginLimitCheck,
  roleGateOf,
} from "./employee-action-guard";

// Acciones de acceso: cambio de rol, reinicio de acceso e invitacion para colaboradores existentes.

type EmployeeInvite = { token: string; expiresAt: string };
type EmployeeRoleRaw = { employeeId: string; roleId: string | null };
type RoleChangeRaw = { profileId: string; roleId: string | null };

const changeRoleFlowAction = defineAction<RoleChangeRaw, RoleChangeRaw, void>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.profileId, raw.roleId]),
  run: (raw, session) => changeEmployeeRoleFlow(roleGateOf(session), raw),
  revalidate: () => ["/employees"],
});

const resetAccessFlowAction = defineAction<EmployeeRoleRaw, EmployeeRoleRaw, EmployeeInvite>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId, raw.roleId]),
  run: (raw, session) => resetEmployeeAccessFlow(roleGateOf(session), raw),
  revalidate: (_out, raw) => ["/employees", `/employees/${raw.employeeId}`],
});

const generateInviteFlowAction = defineAction<EmployeeRoleRaw, EmployeeRoleRaw, EmployeeInvite>({
  ...EMPLOYEE_GUARD,
  parse: (raw) => checkIds(raw, [raw.employeeId, raw.roleId]),
  run: (raw, session) =>
    generateEmployeeInviteFlow({ ...roleGateOf(session), checkLoginLimit: loginLimitCheck(session.salonId) }, raw),
  revalidate: (_out, raw) => [`/employees/${raw.employeeId}`],
});

export async function changeEmployeeRoleAction(profileId: string, roleId: string | null): Promise<Result<void>> {
  return changeRoleFlowAction({ profileId, roleId });
}

export async function resetEmployeeAccessAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<EmployeeInvite>> {
  return resetAccessFlowAction({ employeeId, roleId });
}

export async function generateEmployeeInviteAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<EmployeeInvite>> {
  return generateInviteFlowAction({ employeeId, roleId });
}
