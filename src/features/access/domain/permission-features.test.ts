import { describe, expect, it } from "vitest";
import { SALON_FEATURES } from "@/features/salon-features";
import type { ProfileWithRole } from "@/types/app.types";
import { PERMISSION_CATALOG } from "./permissions";
import {
  PERMISSIONS,
  hasPermission,
  type Permission,
} from "./permission-checks";

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];
const FEATURE_KEYS: string[] = SALON_FEATURES.map((feature) => feature.key);

function ownerWith(disabledFeatures: string[]): ProfileWithRole {
  return {
    id: "owner-1",
    salon_id: "salon-1",
    role_id: null,
    is_owner: true,
    full_name: "Dueña",
    is_active: true,
    salon: { disabled_features: disabledFeatures },
    role: null,
  };
}

describe("permisos y módulos del salón", () => {
  it("con todos los módulos activos, el owner tiene todos los permisos", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(ownerWith([]), permission)).toBe(true);
    }
  });

  it("con todos los módulos desactivados, ningún permiso queda activo", () => {
    // Cada permiso depende de al menos un módulo real de SALON_FEATURES.
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(ownerWith(FEATURE_KEYS), permission)).toBe(false);
    }
  });

  it("asocia recordatorios a los módulos recordatorios y plantillas", () => {
    expect(hasPermission(ownerWith(["plantillas"]), PERMISSIONS.REMINDERS_SEND)).toBe(false);
    expect(hasPermission(ownerWith(["recordatorios"]), PERMISSIONS.REMINDERS_SEND)).toBe(false);
    expect(hasPermission(ownerWith(["reports"]), PERMISSIONS.REMINDERS_SEND)).toBe(true);
  });

  it("coincide con el catálogo de permisos de la base de datos", () => {
    const catalogKeys = PERMISSION_CATALOG.map((permission) => permission.key).sort();
    expect([...ALL_PERMISSIONS].sort()).toEqual(catalogKeys);
  });
});
