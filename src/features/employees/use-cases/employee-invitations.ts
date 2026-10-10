import { captureError } from "@/infra/observability";
import {
  findAssignableEmployeeRole,
  insertEmployeeProfile,
  linkEmployeeProfile,
} from "@/features/employees/data/employee-access.repo";
import {
  findEmployeeInvitationForJoin,
  markEmployeeInvitationAccepted,
  type EmployeeInvitationForJoin,
} from "@/features/employees/data/employee-invitations.repo";
import {
  createEmployeeAuthUser,
  deleteEmployeeAuthUser,
} from "@/features/employees/data/employee-auth.repo";
import type { Result } from "@/infra/result";

export type EmployeeInvitationJoinView =
  | { status: "not_found" }
  | { status: "accepted" }
  | { status: "expired" }
  | {
      status: "pending";
      token: string;
      email: string;
      employeeName: string;
      salonName: string;
    };

/** Dependencias de la vista del enlace. Producción usa las funciones reales; los tests inyectan fakes. */
export interface EmployeeInvitationJoinDeps {
  findInvitationForJoin: typeof findEmployeeInvitationForJoin;
}

/** Dependencias de la aceptación del enlace: lectura, creación de cuenta, perfil, vínculo y rollback. */
export interface AcceptEmployeeInvitationDeps extends EmployeeInvitationJoinDeps {
  findAssignableRole: typeof findAssignableEmployeeRole;
  createAuthUser: typeof createEmployeeAuthUser;
  deleteAuthUser: typeof deleteEmployeeAuthUser;
  insertProfile: typeof insertEmployeeProfile;
  linkProfile: typeof linkEmployeeProfile;
  markAccepted: typeof markEmployeeInvitationAccepted;
}

const defaultEmployeeInvitationJoinDeps: EmployeeInvitationJoinDeps = {
  findInvitationForJoin: findEmployeeInvitationForJoin,
};

const defaultAcceptEmployeeInvitationDeps: AcceptEmployeeInvitationDeps = {
  ...defaultEmployeeInvitationJoinDeps,
  findAssignableRole: findAssignableEmployeeRole,
  createAuthUser: createEmployeeAuthUser,
  deleteAuthUser: deleteEmployeeAuthUser,
  insertProfile: insertEmployeeProfile,
  linkProfile: linkEmployeeProfile,
  markAccepted: markEmployeeInvitationAccepted,
};

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function employeeName(invitation: EmployeeInvitationForJoin): string {
  const employee = invitation.employees;
  if (!employee) return "Colaborador";
  return `${employee.first_name} ${employee.last_name}`.trim() || "Colaborador";
}

export async function getEmployeeInvitationJoinView(
  token: string,
  deps: EmployeeInvitationJoinDeps = defaultEmployeeInvitationJoinDeps
): Promise<EmployeeInvitationJoinView> {
  const { data: invitation, error } = await deps.findInvitationForJoin(token);

  if (error) {
    captureError(error, { module: "employees", action: "join" });
    return { status: "not_found" };
  }

  if (!invitation) return { status: "not_found" };
  if (invitation.accepted_at) return { status: "accepted" };
  if (isExpired(invitation.expires_at)) return { status: "expired" };

  return {
    status: "pending",
    token,
    email: invitation.email,
    employeeName: employeeName(invitation),
    salonName: invitation.salons?.name ?? "tu salón",
  };
}

async function rollbackAuthUser(
  userId: string,
  context: string,
  deps: Pick<AcceptEmployeeInvitationDeps, "deleteAuthUser">
): Promise<void> {
  const { error } = await deps.deleteAuthUser(userId);
  if (error && error.status !== 404) {
    captureError(error, { module: "employees", action: "join-rollback", metadata: { context } });
  }
}

export async function acceptEmployeeInvitation(
  {
    token,
    password,
  }: {
    token: string;
    password: string;
  },
  deps: AcceptEmployeeInvitationDeps = defaultAcceptEmployeeInvitationDeps
): Promise<Result<void>> {
  if (!password || password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { data: invitation, error } = await deps.findInvitationForJoin(token);
  if (error) {
    captureError(error, { module: "employees", action: "join" });
    return { ok: false, error: "No se pudo verificar la invitación." };
  }

  if (!invitation) return { ok: false, error: "El enlace no es válido." };
  if (invitation.accepted_at) return { ok: false, error: "Este enlace ya fue utilizado." };
  if (isExpired(invitation.expires_at)) {
    return { ok: false, error: "Este enlace ha expirado. Solicita uno nuevo al administrador." };
  }
  if (!invitation.employees) return { ok: false, error: "Colaborador no encontrado." };

  let roleId: string | null = null;
  if (invitation.role_id) {
    const { data: role, error: roleError } = await deps.findAssignableRole(
      invitation.salon_id,
      invitation.role_id
    );

    if (roleError) {
      captureError(roleError, { module: "employees", action: "join" });
      return { ok: false, error: "No se pudo verificar el rol de la invitación." };
    }

    if (!role) {
      return { ok: false, error: "Este enlace tiene un rol inválido. Solicita un enlace nuevo." };
    }

    roleId = role.id;
  }

  const { data: user, error: authError } = await deps.createAuthUser({
    email: invitation.email,
    password,
    emailConfirm: true,
  });

  if (authError || !user) {
    if (
      authError?.message?.includes("already registered") ||
      authError?.message?.includes("already exists")
    ) {
      return { ok: false, error: "Este email ya tiene una cuenta registrada. Contacta al administrador." };
    }
    return { ok: false, error: "Error al crear la cuenta. Intenta de nuevo." };
  }

  const fullName = employeeName(invitation);
  const { error: profileError } = await deps.insertProfile({
    id: user.id,
    salon_id: invitation.salon_id,
    full_name: fullName,
    is_owner: false,
    role_id: roleId,
  });

  if (profileError) {
    await rollbackAuthUser(user.id, "profile", deps);
    return { ok: false, error: "Error al configurar el perfil. Intenta de nuevo." };
  }

  const { error: employeeError } = await deps.linkProfile(
    invitation.employee_id,
    invitation.salon_id,
    user.id
  );

  if (employeeError) {
    await rollbackAuthUser(user.id, "employee", deps);
    return { ok: false, error: "Error al vincular el colaborador. Intenta de nuevo." };
  }

  const { error: acceptedError } = await deps.markAccepted(invitation.id, invitation.salon_id);
  if (acceptedError) {
    captureError(acceptedError, { module: "employees", action: "join" });
    await rollbackAuthUser(user.id, "accepted", deps);
    return { ok: false, error: "Error al confirmar la invitación. Solicita un enlace nuevo." };
  }

  return { ok: true, value: undefined };
}
