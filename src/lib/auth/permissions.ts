import type { ProfileWithRole } from "@/types/app.types";

export const PERMISSIONS = {
  SALON_MANAGE: "salon.manage",
  ROLES_MANAGE: "roles.manage",
  EMPLOYEES_MANAGE: "employees.manage",
  SERVICES_MANAGE: "services.manage",
  CUSTOMERS_MANAGE: "customers.manage",
  APPOINTMENTS_VIEW: "appointments.view",
  APPOINTMENTS_MANAGE: "appointments.manage",
  APPOINTMENTS_VIEW_ALL: "appointments.view_all",
  REPORTS_VIEW: "reports.view",
  REMINDERS_SEND: "reminders.send",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  profile: ProfileWithRole,
  permission: Permission
): boolean {
  if (profile.is_owner) return true;
  return (
    profile.role?.role_permissions.some(
      (rp) => rp.permission?.key === permission
    ) ?? false
  );
}

export function getPermissions(profile: ProfileWithRole): Permission[] {
  if (profile.is_owner) return Object.values(PERMISSIONS) as Permission[];
  return (
    profile.role?.role_permissions
      .map((rp) => rp.permission?.key)
      .filter((key): key is Permission =>
        key !== undefined && (Object.values(PERMISSIONS) as string[]).includes(key)
      ) ?? []
  );
}
