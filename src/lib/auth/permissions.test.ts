import { describe, expect, it } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import {
  PERMISSIONS,
  getDisabledSalonFeatures,
  getPermissions,
  hasPermission,
  type Permission,
} from "./permissions";

type RolePermissionKey = string | null;

function profile(overrides: {
  isOwner?: boolean;
  disabledFeatures?: string[] | null;
  permissionKeys?: RolePermissionKey[];
  hasRole?: boolean;
  hasSalon?: boolean;
}): ProfileWithRole {
  const hasRole = overrides.hasRole ?? true;
  const hasSalon = overrides.hasSalon ?? true;
  return {
    id: "user-1",
    salon_id: "salon-1",
    role_id: hasRole ? "role-1" : null,
    is_owner: overrides.isOwner ?? false,
    full_name: "Usuario Prueba",
    is_active: true,
    salon: hasSalon ? { disabled_features: overrides.disabledFeatures ?? null } : null,
    role: hasRole
      ? {
          id: "role-1",
          name: "Recepcion",
          role_permissions: (overrides.permissionKeys ?? []).map((key) => ({
            permission:
              key === null ? null : { id: `p-${key}`, key, description: "descripcion" },
          })),
        }
      : null,
  };
}

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

describe("permission catalog in lib/auth", () => {
  it("keeps the 13 canonical permission keys", () => {
    expect(ALL_PERMISSIONS).toHaveLength(13);
    expect(new Set(ALL_PERMISSIONS).size).toBe(13);
  });
});

describe("salon feature gating and getDisabledSalonFeatures", () => {
  it("treats every feature as enabled when the salon has no disabled list", () => {
    const owner = profile({ disabledFeatures: null, isOwner: true });

    expect(hasPermission(owner, PERMISSIONS.APPOINTMENTS_VIEW)).toBe(true);
    expect(getDisabledSalonFeatures(owner)).toEqual([]);
  });

  it("ignores unknown feature keys and deduplicates known ones", () => {
    const owner = profile({ disabledFeatures: ["reports", "reports", "ovni"], isOwner: true });

    expect(getDisabledSalonFeatures(owner)).toEqual(["reports"]);
    expect(hasPermission(owner, PERMISSIONS.REPORTS_VIEW)).toBe(false);
    expect(hasPermission(owner, PERMISSIONS.SERVICES_MANAGE)).toBe(true);
  });

  it("treats a profile without salon row as having no disabled features", () => {
    const orphan = profile({ hasSalon: false, isOwner: true });

    expect(getDisabledSalonFeatures(orphan)).toEqual([]);
    expect(hasPermission(orphan, PERMISSIONS.REPORTS_VIEW)).toBe(true);
  });
});

describe("hasPermission", () => {
  it("short-circuits to true for the salon owner", () => {
    const owner = profile({ isOwner: true, hasRole: false });

    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(owner, permission)).toBe(true);
    }
  });

  it("grants only the permissions present on the role for non-owners", () => {
    const reception = profile({
      permissionKeys: ["appointments.view", "appointments.manage"],
    });

    expect(hasPermission(reception, PERMISSIONS.APPOINTMENTS_MANAGE)).toBe(true);
    expect(hasPermission(reception, PERMISSIONS.REPORTS_VIEW)).toBe(false);
  });

  it("denies everything to a profile without role", () => {
    expect(hasPermission(profile({ hasRole: false }), PERMISSIONS.APPOINTMENTS_VIEW)).toBe(false);
  });

  it("ignores role permission entries whose catalog row is missing", () => {
    const withBrokenLink = profile({ permissionKeys: [null, "reports.view"] });

    expect(hasPermission(withBrokenLink, PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(hasPermission(withBrokenLink, PERMISSIONS.SALON_MANAGE)).toBe(false);
  });

  it("denies a permission whose feature is disabled, even for the owner", () => {
    const owner = profile({ isOwner: true, disabledFeatures: ["expenses"] });

    expect(hasPermission(owner, PERMISSIONS.EXPENSES_MANAGE)).toBe(false);
    expect(hasPermission(owner, PERMISSIONS.SERVICES_MANAGE)).toBe(true);
  });

  it("denies a granted role permission when its feature is disabled", () => {
    const staff = profile({
      permissionKeys: ["retail.manage"],
      disabledFeatures: ["retail"],
    });

    expect(hasPermission(staff, PERMISSIONS.RETAIL_MANAGE)).toBe(false);
  });

  it("keeps reminders.send ungated by salon features and denies ungranted appointments.view_all", () => {
    const staff = profile({
      permissionKeys: ["reminders.send"],
      disabledFeatures: ["appointments", "customers"],
    });

    expect(hasPermission(staff, PERMISSIONS.REMINDERS_SEND)).toBe(true);
    expect(hasPermission(staff, PERMISSIONS.APPOINTMENTS_VIEW_ALL)).toBe(false);
  });
});

describe("getPermissions", () => {
  it("returns the full catalog for the owner", () => {
    expect(getPermissions(profile({ isOwner: true }))).toEqual(ALL_PERMISSIONS);
  });

  it("returns the owner catalog minus features disabled for the salon", () => {
    const owner = profile({ isOwner: true, disabledFeatures: ["appointments"] });
    const permissions = getPermissions(owner);

    expect(permissions).not.toContain(PERMISSIONS.APPOINTMENTS_VIEW);
    expect(permissions).not.toContain(PERMISSIONS.APPOINTMENTS_MANAGE);
    expect(permissions).not.toContain(PERMISSIONS.APPOINTMENTS_VIEW_ALL);
    expect(permissions).toContain(PERMISSIONS.REMINDERS_SEND);
  });

  it("returns only known role permissions for non-owners, dropping unknown and null keys", () => {
    const staff = profile({
      permissionKeys: ["reports.view", "legacy.something", null, "services.manage"],
    });

    expect(getPermissions(staff)).toEqual(["reports.view", "services.manage"]);
  });

  it("returns an empty list when the non-owner has no role", () => {
    expect(getPermissions(profile({ hasRole: false }))).toEqual([]);
  });

  it("is consistent with hasPermission for every catalog key", () => {
    const staff = profile({
      permissionKeys: ["customers.manage", "inventory.manage"],
      disabledFeatures: ["inventory"],
    });
    const granted = new Set(getPermissions(staff));

    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(staff, permission)).toBe(granted.has(permission));
    }
  });
});
