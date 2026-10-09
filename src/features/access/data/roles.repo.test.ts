import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeSupabase,
  type FakeSupabaseClient,
} from "@/test/access-employees-supabase-fake";
import {
  createRole,
  deleteRole,
  findAllPermissions,
  findRolesWithPermissions,
  setRolePermissions,
} from "./roles.repo";

// Repositorio de roles: toda consulta sobre roles y sus permisos debe quedar
// acotada al salón, porque la RLS no es la única barrera que protege a los tenants.

const dbHolder = vi.hoisted(() => ({ current: null as FakeSupabaseClient | null }));

vi.mock("@/lib/supabase/server", () => ({
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

  describe("createRole", () => {
    it("inserta el rol con el salon_id del contexto y devuelve su id", async () => {
      useTables({ roles: [{ data: { id: "nuevo-rol" }, error: null }] });

      await expect(createRole(SALON_ID, "Estilista")).resolves.toBe("nuevo-rol");

      expect(db.argsOf("roles", "insert")).toEqual([{ salon_id: SALON_ID, name: "Estilista" }]);
      expect(db.argsOf("roles", "select")).toEqual(["id"]);
    });

    it("propaga el error de inserción tal cual para que el use-case lo clasifique", async () => {
      const dbError = { code: "23505", message: "duplicate key" };
      useTables({ roles: [{ data: null, error: dbError }] });

      await expect(createRole(SALON_ID, "Estilista")).rejects.toEqual(dbError);
    });
  });

  describe("setRolePermissions", () => {
    it("verifica que el rol pertenezca al salón antes de tocar permisos", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [{ data: [{ id: "p1", key: "reports.view" }], error: null }],
        role_permissions: [{ data: null, error: null }, { data: null, error: null }],
      });

      await setRolePermissions(ROLE_ID, SALON_ID, ["reports.view"]);

      expect(db.callsFor("roles")).toEqual([
        expect.objectContaining({ method: "select" }),
        { table: "roles", method: "eq", args: ["id", ROLE_ID] },
        { table: "roles", method: "eq", args: ["salon_id", SALON_ID] },
        expect.objectContaining({ method: "single" }),
      ]);
    });

    it("reemplaza los permisos: borra los anteriores del rol y del salón y luego inserta los nuevos", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [
          {
            data: [
              { id: "p1", key: "reports.view" },
              { id: "p2", key: "customers.manage" },
            ],
            error: null,
          },
        ],
        role_permissions: [{ data: null, error: null }, { data: null, error: null }],
      });

      await setRolePermissions(ROLE_ID, SALON_ID, ["reports.view", "customers.manage"]);

      expect(db.argsOf("permissions", "in")).toEqual(["key", ["reports.view", "customers.manage"]]);
      expect(db.callsFor("role_permissions")).toEqual([
        expect.objectContaining({ method: "delete" }),
        { table: "role_permissions", method: "eq", args: ["role_id", ROLE_ID] },
        { table: "role_permissions", method: "eq", args: ["salon_id", SALON_ID] },
        expect.objectContaining({ method: "insert" }),
      ]);
      expect(db.argsOf("role_permissions", "insert")).toEqual([
        [
          { role_id: ROLE_ID, permission_id: "p1", salon_id: SALON_ID },
          { role_id: ROLE_ID, permission_id: "p2", salon_id: SALON_ID },
        ],
      ]);
    });

    it("con lista vacía limpia los permisos sin insertar nada", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [{ data: [], error: null }],
        role_permissions: [{ data: null, error: null }],
      });

      await setRolePermissions(ROLE_ID, SALON_ID, []);

      expect(db.callsFor("role_permissions").map((call) => call.method)).toEqual([
        "delete",
        "eq",
        "eq",
      ]);
    });

    it("lanza 'Rol no encontrado.' cuando la consulta no devuelve rol", async () => {
      useTables({
        roles: [{ data: null, error: null }],
      });

      await expect(setRolePermissions(ROLE_ID, SALON_ID, [])).rejects.toThrow(
        "Rol no encontrado."
      );
      expect(db.callsFor("role_permissions")).toHaveLength(0);
    });

    it("propaga el error al buscar el rol y no toca permisos", async () => {
      const roleError = { message: "rol inaccesible" };
      useTables({ roles: [{ data: null, error: roleError }] });

      await expect(setRolePermissions(ROLE_ID, SALON_ID, ["reports.view"])).rejects.toEqual(
        roleError
      );
      expect(db.callsFor("role_permissions")).toHaveLength(0);
    });

    it("rechaza si alguna clave pedida no existe en el catálogo", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [{ data: [{ id: "p1", key: "reports.view" }], error: null }],
      });

      await expect(
        setRolePermissions(ROLE_ID, SALON_ID, ["reports.view", "no.existe"])
      ).rejects.toThrow("Uno o mas permisos no existen.");
      expect(db.callsFor("role_permissions")).toHaveLength(0);
    });

    it("propaga el error al consultar el catálogo de permisos", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [{ data: null, error: { message: "catálogo caído" } }],
      });

      await expect(setRolePermissions(ROLE_ID, SALON_ID, ["reports.view"])).rejects.toEqual({
        message: "catálogo caído",
      });
      expect(db.callsFor("role_permissions")).toHaveLength(0);
    });

    it("propaga el error al borrar permisos anteriores", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [{ data: [], error: null }],
        role_permissions: [{ data: null, error: { message: "delete rechazado" } }],
      });

      await expect(setRolePermissions(ROLE_ID, SALON_ID, [])).rejects.toEqual({
        message: "delete rechazado",
      });
    });

    it("propaga el error al insertar los permisos nuevos", async () => {
      useTables({
        roles: [{ data: { id: ROLE_ID }, error: null }],
        permissions: [{ data: [{ id: "p1", key: "reports.view" }], error: null }],
        role_permissions: [
          { data: null, error: null },
          { data: null, error: { message: "insert rechazado" } },
        ],
      });

      await expect(setRolePermissions(ROLE_ID, SALON_ID, ["reports.view"])).rejects.toEqual({
        message: "insert rechazado",
      });
    });
  });

  describe("deleteRole", () => {
    it("borra el rol solo si pertenece al salón y no es de sistema", async () => {
      useTables({
        roles: [
          { data: { is_system: false }, error: null },
          { data: null, error: null },
        ],
      });

      await deleteRole(ROLE_ID, SALON_ID);

      expect(db.callsFor("roles")).toEqual([
        expect.objectContaining({ method: "select" }),
        { table: "roles", method: "eq", args: ["id", ROLE_ID] },
        { table: "roles", method: "eq", args: ["salon_id", SALON_ID] },
        expect.objectContaining({ method: "single" }),
        expect.objectContaining({ method: "delete" }),
        { table: "roles", method: "eq", args: ["id", ROLE_ID] },
        { table: "roles", method: "eq", args: ["salon_id", SALON_ID] },
      ]);
    });

    it("no borra roles de sistema", async () => {
      useTables({ roles: [{ data: { is_system: true }, error: null }] });

      await expect(deleteRole(ROLE_ID, SALON_ID)).rejects.toThrow(
        "Los roles de sistema no se pueden eliminar."
      );
      expect(db.callsFor("roles").map((call) => call.method)).toEqual([
        "select",
        "eq",
        "eq",
        "single",
      ]);
    });

    it("lanza 'Rol no encontrado.' si el rol no existe en el salón", async () => {
      useTables({ roles: [{ data: null, error: null }] });

      await expect(deleteRole(ROLE_ID, SALON_ID)).rejects.toThrow("Rol no encontrado.");
    });

    it("propaga el error al buscar el rol", async () => {
      useTables({ roles: [{ data: null, error: { message: "búsqueda fallida" } }] });

      await expect(deleteRole(ROLE_ID, SALON_ID)).rejects.toEqual({
        message: "búsqueda fallida",
      });
    });

    it("propaga el error al ejecutar el borrado", async () => {
      useTables({
        roles: [
          { data: { is_system: false }, error: null },
          { data: null, error: { message: "borrado rechazado" } },
        ],
      });

      await expect(deleteRole(ROLE_ID, SALON_ID)).rejects.toEqual({
        message: "borrado rechazado",
      });
    });
  });
});
