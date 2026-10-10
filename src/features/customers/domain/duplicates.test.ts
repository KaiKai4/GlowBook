import { describe, expect, it } from "vitest";
import {
  isPermanentCandidate,
  pickArchivedMatch,
  type DuplicateCandidate,
} from "./duplicates";

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    id: "cust-1",
    first_name: "Ana",
    last_name: "Perez",
    phone: "61234567",
    email: "ana@example.com",
    is_active: true,
    is_temporary: false,
    ...overrides,
  };
}

describe("customers domain: duplicados", () => {
  describe("isPermanentCandidate", () => {
    it("es permanente cuando no es temporal, esté activo o no", () => {
      expect(isPermanentCandidate(candidate())).toBe(true);
      expect(isPermanentCandidate(candidate({ is_active: false }))).toBe(true);
    });

    it("un temporal no cuenta como permanente", () => {
      expect(isPermanentCandidate(candidate({ is_temporary: true }))).toBe(false);
    });
  });

  describe("criterio de archivado permanente (vía pickArchivedMatch)", () => {
    const isArchivedMatch = (customer: DuplicateCandidate) => pickArchivedMatch([customer]) !== null;

    it("exige estar archivado y no ser temporal", () => {
      expect(isArchivedMatch(candidate({ is_active: false }))).toBe(true);
    });

    it("un activo no está archivado", () => {
      expect(isArchivedMatch(candidate())).toBe(false);
    });

    it("un temporal archivado no cuenta como archivado permanente", () => {
      expect(isArchivedMatch(candidate({ is_active: false, is_temporary: true }))).toBe(false);
    });
  });

  describe("nombre visible de la coincidencia", () => {
    const nameOf = (first: string, last: string) =>
      pickArchivedMatch([candidate({ is_active: false, first_name: first, last_name: last })])?.name;

    it("une nombre y apellido sin espacios sobrantes", () => {
      expect(nameOf("Ana", "Perez")).toBe("Ana Perez");
      expect(nameOf("Ana", "")).toBe("Ana");
      expect(nameOf("", "")).toBe("");
    });
  });

  describe("pickArchivedMatch", () => {
    it("devuelve null sin candidatos o sin archivados permanentes", () => {
      expect(pickArchivedMatch([])).toBeNull();
      expect(pickArchivedMatch([null, undefined])).toBeNull();
      expect(pickArchivedMatch([candidate(), null])).toBeNull();
      expect(
        pickArchivedMatch([candidate({ is_active: false, is_temporary: true })])
      ).toBeNull();
    });

    it("devuelve el primer archivado permanente con su forma pública", () => {
      const match = pickArchivedMatch([
        null,
        candidate({ id: "activo" }),
        candidate({
          id: "archivado",
          first_name: "Lucia ",
          last_name: " Mora",
          phone: "70000000",
          email: null,
          is_active: false,
        }),
        candidate({ id: "otro", is_active: false }),
      ]);

      expect(match).toEqual({
        id: "archivado",
        name: "Lucia   Mora",
        phone: "70000000",
        email: null,
      });
    });

    it("ignora temporales archivados y elige el permanente siguiente", () => {
      const match = pickArchivedMatch([
        candidate({ id: "temporal", is_active: false, is_temporary: true }),
        candidate({ id: "permanente", is_active: false }),
      ]);
      expect(match?.id).toBe("permanente");
    });
  });
});
