import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  deleteRole,
  findAllPermissions,
  findRoleForDelete,
  findRolesWithPermissions,
} from "./roles.repo";

// Repositorio de roles: toda consulta sobre roles y sus permisos debe quedar
// acotada al salón, porque la RLS no es la única barrera que protege a los tenants.

const dbHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => dbHolder.current,
}));

const SALON_ID = "salon-1";
const ROLE_ID = "role-1";

let db: FakeSupabase;

function useTables(responses: Parameters<typeof createFakeSupabase>[0]) {
  db = createFakeSupabase(responses);
  dbHolder.current = db.client;
}

describe("roles repo", () => {
  beforeEach(() => {
    dbHolder.current = null;
  });

  describe("findRolesWithPermissions", () => {
    it("consulta solo los roles del salón pedido, ordenados por nombre", async () => {
      useTables({ roles: [{ data: [{ id: ROLE_ID }], error: null }] });

      await expect(findRolesWithPermissions(SALON_ID)).resolves.toEqual([{ id: ROLE_ID }]);

      expect(db.callsFor("roles")).toEqual([
        expect.objectContaining({ method: "select" }),
        { table: "roles", method: "eq", args: ["salon_id", SALON_ID] },
        { table: "roles", method: "order", args: ["name", { ascending: true }] },
      ]);
    });

    it("pide las columnas del rol y sus permisos anidados", async () => {
      useTables({ roles: [{ data: [], error: null }] });

      await findRolesWithPermissions(SALON_ID);

      const selected = db.argsOf("roles", "select")?.[0];
      expect(typeof selected).toBe("string");
      expect(selected).toContain("role_permissions(permission:permissions(id, key, description))");
    });

    it("devuelve lista vacía cuando la consulta no trae datos", async () => {
      useTables({ roles: [{ data: null, error: null }] });

      await expect(findRolesWithPermissions(SALON_ID)).resolves.toEqual([]);
    });

    it("propaga el error de la consulta", async () => {
      useTables({ roles: [{ data: null, error: { message: "fallo de red" } }] });

      await expect(findRolesWithPermissions(SALON_ID)).rejects.toEqual({ message: "fallo de red" });
    });
  });

  describe("findAllPermissions", () => {
    it("lee el catálogo global de permisos ordenado por clave sin filtrar por salón", async () => {
      const catalog = [{ id: "p1", key: "reports.view", description: "Ver reportes" }];
      useTables({ permissions: [{ data: catalog, error: null }] });

      await expect(findAllPermissions()).resolves.toEqual(catalog);

      expect(db.callsFor("permissions")).toEqual([
        { table: "permissions", method: "select", args: ["*"] },
        { table: "permissions", method: "order", args: ["key"] },
      ]);
    });

    it("devuelve lista vacía cuando no hay datos", async () => {
      useTables({ permissions: [{ data: null, error: null }] });

      await expect(findAllPermissions()).resolves.toEqual([]);
    });

    it("propaga el error del catálogo", async () => {
      useTables({ permissions: [{ data: null, error: { message: "sin acceso" } }] });

      await expect(findAllPermissions()).rejects.toEqual({ message: "sin acceso" });
    });
  });

  describe("findRoleForDelete", () => {
    it("consulta el rol acotado al salón, sin decidir sobre él", async () => {
      useTables({ roles: [{ data: { is_system: true }, error: null }] });

      await expect(findRoleForDelete(ROLE_ID, SALON_ID)).resolves.toEqual({ is_system: true });
      expect(db.callsFor("roles")).toEqual([
        expect.objectContaining({ method: "select" }),
        { table: "roles", method: "eq", args: ["id", ROLE_ID] },
        { table: "roles", method: "eq", args: ["salon_id", SALON_ID] },
        expect.objectContaining({ method: "single" }),
      ]);
    });

    it("devuelve null si el rol no existe en el salón", async () => {
      useTables({ roles: [{ data: null, error: null }] });

      await expect(findRoleForDelete(ROLE_ID, SALON_ID)).resolves.toBeNull();
    });

    it("propaga el error al buscar el rol", async () => {
      useTables({ roles: [{ data: null, error: { message: "búsqueda fallida" } }] });

      await expect(findRoleForDelete(ROLE_ID, SALON_ID)).rejects.toEqual({
        message: "búsqueda fallida",
      });
    });
  });

  describe("deleteRole", () => {
    it("borra el rol acotado al salón", async () => {
      useTables({ roles: [{ data: null, error: null }] });

      await deleteRole(ROLE_ID, SALON_ID);

      expect(db.callsFor("roles")).toEqual([
        expect.objectContaining({ method: "delete" }),
        { table: "roles", method: "eq", args: ["id", ROLE_ID] },
        { table: "roles", method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    });

    it("propaga el error al ejecutar el borrado", async () => {
      useTables({ roles: [{ data: null, error: { message: "borrado rechazado" } }] });

      await expect(deleteRole(ROLE_ID, SALON_ID)).rejects.toEqual({
        message: "borrado rechazado",
      });
    });
  });
});
