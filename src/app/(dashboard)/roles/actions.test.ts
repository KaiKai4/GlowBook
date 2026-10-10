import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { createRoleWithPermissions } from "@/features/access/use-cases/create-role";
import { deleteSalonRole } from "@/features/access/use-cases/delete-role";
import { updateRolePermissions } from "@/features/access/use-cases/update-role-permissions";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import { createRoleAction, deleteRoleAction, updateRolePermissionsAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  const requireActiveProfile = vi.fn();
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/features/access/use-cases/create-role", () => ({ createRoleWithPermissions: vi.fn() }));
vi.mock("@/features/access/use-cases/delete-role", () => ({ deleteSalonRole: vi.fn() }));
vi.mock("@/features/access/use-cases/update-role-permissions", () => ({
  updateRolePermissions: vi.fn(),
}));

const rolesManager = buildProfile({ permissions: [PERMISSIONS.ROLES_MANAGE] });
const invalidPermissions = "Permisos invalidos.";

describe("roles actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(rolesManager);
  });

  it("todas las acciones rechazan a un perfil sin permiso de roles", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
    const denied = { ok: false, error: "No tienes permiso para gestionar roles." };

    expect(await createRoleAction(null, formDataOf({ name: "Caja" }))).toEqual(denied);
    expect(await updateRolePermissionsAction(null, formDataOf({ role_id: RECORD_ID }))).toEqual(denied);
    expect(await deleteRoleAction(RECORD_ID)).toEqual(denied);
    expect(createRoleWithPermissions).not.toHaveBeenCalled();
    expect(updateRolePermissions).not.toHaveBeenCalled();
    expect(deleteSalonRole).not.toHaveBeenCalled();
  });

  describe("createRoleAction", () => {
    it("rechaza permisos que no son un JSON válido", async () => {
      expect(await createRoleAction(null, formDataOf({ name: "Caja", permission_keys: "{no-json" }))).toEqual({
        ok: false,
        error: invalidPermissions,
      });
    });

    it("rechaza permisos que no son un arreglo de textos", async () => {
      expect(
        await createRoleAction(null, formDataOf({ name: "Caja", permission_keys: '{"clave":1}' }))
      ).toEqual({ ok: false, error: invalidPermissions });
      expect(await createRoleAction(null, formDataOf({ name: "Caja", permission_keys: "[1,2]" }))).toEqual({
        ok: false,
        error: invalidPermissions,
      });
      expect(createRoleWithPermissions).not.toHaveBeenCalled();
    });

    it("rechaza un nombre vacío con el mensaje de Zod", async () => {
      expect(await createRoleAction(null, formDataOf({ name: "" }))).toEqual({
        ok: false,
        error: "El nombre del rol es obligatorio",
      });
      expect(createRoleWithPermissions).not.toHaveBeenCalled();
    });

    it("crea el rol con las claves de permiso parseadas y revalida /roles", async () => {
      vi.mocked(createRoleWithPermissions).mockResolvedValue(ok("role-1"));

      const result = await createRoleAction(
        null,
        formDataOf({ name: "Recepción", permission_keys: '["appointments.view","customers.manage"]' })
      );

      expect(result).toEqual({ ok: true, value: "role-1" });
      expect(createRoleWithPermissions).toHaveBeenCalledWith({
        name: "Recepción",
        permission_keys: ["appointments.view", "customers.manage"],
      });
      expect(revalidatePath).toHaveBeenCalledWith("/roles");
    });

    it("crea el rol sin permisos cuando el campo viene vacío", async () => {
      vi.mocked(createRoleWithPermissions).mockResolvedValue(ok("role-2"));

      await createRoleAction(null, formDataOf({ name: "Solo lectura", permission_keys: "   " }));

      expect(createRoleWithPermissions).toHaveBeenCalledWith({
        name: "Solo lectura",
        permission_keys: [],
      });
    });

    it("no revalida si la creación falla", async () => {
      vi.mocked(createRoleWithPermissions).mockResolvedValue(err("Ya existe un rol con ese nombre."));

      expect(await createRoleAction(null, formDataOf({ name: "Caja" }))).toEqual({
        ok: false,
        error: "Ya existe un rol con ese nombre.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateRolePermissionsAction", () => {
    it("rechaza permisos inválidos antes de validar el rol", async () => {
      expect(
        await updateRolePermissionsAction(null, formDataOf({ role_id: RECORD_ID, permission_keys: "[true]" }))
      ).toEqual({ ok: false, error: invalidPermissions });
      expect(updateRolePermissions).not.toHaveBeenCalled();
    });

    it("rechaza un identificador de rol inválido sin actualizar nada", async () => {
      const result = await updateRolePermissionsAction(
        null,
        formDataOf({ role_id: "no-uuid", permission_keys: '["roles.manage"]' })
      );

      expect(result.ok).toBe(false);
      expect(updateRolePermissions).not.toHaveBeenCalled();
    });

    it("actualiza los permisos del rol y revalida /roles", async () => {
      vi.mocked(updateRolePermissions).mockResolvedValue(ok(undefined));

      const result = await updateRolePermissionsAction(
        null,
        formDataOf({ role_id: RECORD_ID, permission_keys: '["reports.view"]' })
      );

      expect(result).toEqual({ ok: true, value: undefined });
      expect(updateRolePermissions).toHaveBeenCalledWith({
        role_id: RECORD_ID,
        permission_keys: ["reports.view"],
      });
      expect(revalidatePath).toHaveBeenCalledWith("/roles");
    });
  });

  describe("deleteRoleAction", () => {
    it("elimina el rol y revalida solo si la eliminación tiene éxito", async () => {
      vi.mocked(deleteSalonRole).mockResolvedValue(ok(undefined));
      expect(await deleteRoleAction(RECORD_ID)).toEqual({ ok: true, value: undefined });
      expect(deleteSalonRole).toHaveBeenCalledWith(SALON_ID, RECORD_ID);
      expect(revalidatePath).toHaveBeenCalledWith("/roles");

      vi.clearAllMocks();
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesManager);
      vi.mocked(deleteSalonRole).mockResolvedValue(err("El rol tiene empleados asignados."));
      expect(await deleteRoleAction(RECORD_ID)).toEqual({
        ok: false,
        error: "El rol tiene empleados asignados.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
