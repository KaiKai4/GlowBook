import { describe, expect, it } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import { withDisabledFeatures } from "./with-disabled-features";

const profile: ProfileWithRole = {
  id: "user-1",
  salon_id: "salon-1",
  role_id: null,
  is_owner: false,
  full_name: "Ana",
  is_active: true,
  salon: { disabled_features: ["reports"] },
};

describe("withDisabledFeatures", () => {
  it("sustituye los módulos desactivados y conserva el resto del perfil", () => {
    const result = withDisabledFeatures(profile, ["inventory", "expenses"]);

    expect(result.salon).toEqual({ disabled_features: ["inventory", "expenses"] });
    expect(result.id).toBe("user-1");
    expect(result.salon_id).toBe("salon-1");
    expect(result.is_owner).toBe(false);
  });

  it("acepta una lista vacia para reactivar todos los módulos", () => {
    expect(withDisabledFeatures(profile, []).salon).toEqual({ disabled_features: [] });
  });

  it("no modifica el perfil original", () => {
    const original = structuredClone(profile);

    withDisabledFeatures(profile, ["reports"]);

    expect(profile).toEqual(original);
  });

  it("copia la lista recibida para que cambios posteriores no afecten al perfil", () => {
    const features = ["reports"];
    const result = withDisabledFeatures(profile, features);

    features.push("inventory");

    expect(result.salon?.disabled_features).toEqual(["reports"]);
  });
});
