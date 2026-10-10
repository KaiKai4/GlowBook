import { describe, expect, it, vi } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import { PERMISSIONS, getPermissions, hasPermission } from "./permission-checks";

// Simula un permiso que no declara ningun modulo (rama `features` vacia de
// PERMISSION_FEATURES): debe seguir concediendose aunque el salon tenga todo apagado.
vi.mock("@/features/salon-features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/salon-features")>();
  return {
    ...actual,
    salonFeaturesForPermission: (permission: string) =>
      permission === "reminders.send" ? [] : actual.salonFeaturesForPermission(permission),
  };
});

function profile(overrides: { isOwner?: boolean; permissionKeys?: string[]; disabledFeatures?: string[] }): ProfileWithRole {
  return {
    id: "user-1",
    salon_id: "salon-1",
    role_id: "role-1",
    is_owner: overrides.isOwner ?? false,
    full_name: "Usuario Prueba",
    is_active: true,
    salon: { disabled_features: overrides.disabledFeatures ?? null },
    role: {
      id: "role-1",
      name: "Recepcion",
      role_permissions: (overrides.permissionKeys ?? []).map((key) => ({
        permission: { id: `p-${key}`, key, description: "descripcion" },
      })),
    },
  };
}

const ALL_FEATURES = [
  "appointments", "customers", "employees", "services", "inventory", "retail",
  "expenses", "reports", "reminders", "roles", "salon",
];

describe("permisos sin modulos asociados", () => {
  it("concede un permiso sin modulos aunque todos los modulos del salon esten desactivados", () => {
    const staff = profile({ permissionKeys: ["reminders.send"], disabledFeatures: ALL_FEATURES });

    expect(hasPermission(staff, PERMISSIONS.REMINDERS_SEND)).toBe(true);
    expect(getPermissions(staff)).toContain(PERMISSIONS.REMINDERS_SEND);
  });

  it("no concede un permiso sin modulos si el rol no lo tiene", () => {
    const staff = profile({ permissionKeys: ["reports.view"], disabledFeatures: ALL_FEATURES });

    expect(hasPermission(staff, PERMISSIONS.REMINDERS_SEND)).toBe(false);
  });
});
