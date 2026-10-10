import { describe, expect, it } from "vitest";
import {
  isSalonFeatureDisabled,
  normalizeDisabledSalonFeatures,
  SALON_FEATURES,
} from "./salon-features";

describe("salon-features (ramas)", () => {
  describe("normalizeDisabledSalonFeatures", () => {
    it("devuelve lista vacia cuando no llegan funciones deshabilitadas", () => {
      expect(normalizeDisabledSalonFeatures(null)).toEqual([]);
      expect(normalizeDisabledSalonFeatures(undefined)).toEqual([]);
      expect(normalizeDisabledSalonFeatures([])).toEqual([]);
    });

    it("descarta claves desconocidas y elimina duplicados conservando el orden de llegada", () => {
      expect(normalizeDisabledSalonFeatures(["reports", "clave-inventada", "retail", "reports"])).toEqual([
        "reports",
        "retail",
      ]);
    });

    it("reconoce todas las claves del catálogo", () => {
      const allKeys = SALON_FEATURES.map((feature) => feature.key);

      expect(normalizeDisabledSalonFeatures(allKeys)).toEqual(allKeys);
    });
  });

  describe("isSalonFeatureDisabled", () => {
    it("indica que una funcion esta deshabilitada solo si figura en la lista válida", () => {
      expect(isSalonFeatureDisabled(["reports"], "reports")).toBe(true);
      expect(isSalonFeatureDisabled(["reports"], "retail")).toBe(false);
    });

    it("considera habilitadas todas las funciones cuando no hay lista o llega vacia", () => {
      expect(isSalonFeatureDisabled(null, "expenses")).toBe(false);
      expect(isSalonFeatureDisabled(undefined, "expenses")).toBe(false);
      expect(isSalonFeatureDisabled([], "expenses")).toBe(false);
    });

    it("ignora claves desconocidas al evaluar", () => {
      expect(isSalonFeatureDisabled(["no-existe"], "salon")).toBe(false);
    });
  });
});
