import type { ProfileWithRole } from "@/types/app.types";
import {
  isSalonFeatureDisabled,
  normalizeDisabledSalonFeatures,
  type SalonFeatureKey,
} from "@/features/salon/domain/salon-features";

export const PERMISSIONS = {
  SALON_MANAGE: "salon.manage",
  ROLES_MANAGE: "roles.manage",
  EMPLOYEES_MANAGE: "employees.manage",
  SERVICES_MANAGE: "services.manage",
  INVENTORY_MANAGE: "inventory.manage",
  RETAIL_MANAGE: "retail.manage",
  EXPENSES_MANAGE: "expenses.manage",
  CUSTOMERS_MANAGE: "customers.manage",
  APPOINTMENTS_VIEW: "appointments.view",
  APPOINTMENTS_MANAGE: "appointments.manage",
  APPOINTMENTS_VIEW_ALL: "appointments.view_all",
  REPORTS_VIEW: "reports.view",
  REMINDERS_SEND: "reminders.send",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const PERMISSION_FEATURES: Partial<Record<Permission, SalonFeatureKey>> = {
  [PERMISSIONS.SALON_MANAGE]: "salon",
  [PERMISSIONS.ROLES_MANAGE]: "roles",
  [PERMISSIONS.EMPLOYEES_MANAGE]: "employees",
  [PERMISSIONS.SERVICES_MANAGE]: "services",
  [PERMISSIONS.INVENTORY_MANAGE]: "inventory",
  [PERMISSIONS.RETAIL_MANAGE]: "retail",
  [PERMISSIONS.EXPENSES_MANAGE]: "expenses",
  [PERMISSIONS.CUSTOMERS_MANAGE]: "customers",
  [PERMISSIONS.APPOINTMENTS_VIEW]: "appointments",
  [PERMISSIONS.APPOINTMENTS_MANAGE]: "appointments",
  [PERMISSIONS.APPOINTMENTS_VIEW_ALL]: "appointments",
  [PERMISSIONS.REPORTS_VIEW]: "reports",
};

export function getDisabledSalonFeatures(profile: ProfileWithRole): SalonFeatureKey[] {
  return normalizeDisabledSalonFeatures(profile.salon?.disabled_features);
}

function hasSalonFeature(
  profile: ProfileWithRole,
  feature: SalonFeatureKey
): boolean {
  return !isSalonFeatureDisabled(profile.salon?.disabled_features, feature);
}

function isPermissionEnabled(profile: ProfileWithRole, permission: Permission): boolean {
  const feature = PERMISSION_FEATURES[permission];
  return !feature || hasSalonFeature(profile, feature);
}

export function hasPermission(
  profile: ProfileWithRole,
  permission: Permission
): boolean {
  if (!isPermissionEnabled(profile, permission)) return false;
  if (profile.is_owner) return true;
  return (
    profile.role?.role_permissions.some(
      (rp) => rp.permission?.key === permission
    ) ?? false
  );
}

export function getPermissions(profile: ProfileWithRole): Permission[] {
  const permissions = profile.is_owner
    ? (Object.values(PERMISSIONS) as Permission[])
    : (
        profile.role?.role_permissions
          .map((rp) => rp.permission?.key)
          .filter((key): key is Permission =>
            key !== undefined && (Object.values(PERMISSIONS) as string[]).includes(key)
          ) ?? []
      );

  return permissions.filter((permission) => isPermissionEnabled(profile, permission));
}
