import { describe, expect, it, vi } from "vitest";
import { createRoleWithPermissions, type CreateRoleWithPermissionsDeps } from "./create-role";
import { deleteSalonRole, type DeleteSalonRoleDeps } from "./delete-role";
import { updateRolePermissions, type UpdateRolePermissionsDeps } from "./update-role-permissions";

// Fakes tipados: cada caso de uso recibe sus dependencias por parámetro (ADR 0028).

function makeCreateDeps(
  overrides: Partial<CreateRoleWithPermissionsDeps> = {}
): CreateRoleWithPermissionsDeps {
  return {
    createRoleWithPermissionsRpc: vi.fn<CreateRoleWithPermissionsDeps["createRoleWithPermissionsRpc"]>(
      async () => "role-1"
    ),
    ...overrides,
  };
}

function makeUpdateDeps(overrides: Partial<UpdateRolePermissionsDeps> = {}): UpdateRolePermissionsDeps {
  return {
    replaceRolePermissionsRpc: vi.fn<UpdateRolePermissionsDeps["replaceRolePermissionsRpc"]>(
      async () => undefined
    ),
    ...overrides,
  };
}

function makeDeleteDeps(overrides: Partial<DeleteSalonRoleDeps> = {}): DeleteSalonRoleDeps {
  return {
    findRoleForDelete: vi.fn<DeleteSalonRoleDeps["findRoleForDelete"]>(async () => ({ is_system: false })),
    deleteRole: vi.fn<DeleteSalonRoleDeps["deleteRole"]>(async () => undefined),
    ...overrides,
  };
}

describe("role use-cases", () => {
  it("crea el rol con sus permisos en UNA sola llamada RPC, sin claves duplicadas", async () => {
    const deps = makeCreateDeps();

    const result = await createRoleWithPermissions(
      {
        name: "Estilista",
        permission_keys: ["appointments.view", "appointments.view", "customers.manage"],
      },
      deps
    );

    expect(result).toEqual({ ok: true, value: "role-1" });
    expect(deps.createRoleWithPermissionsRpc).toHaveBeenCalledTimes(1);
    expect(deps.createRoleWithPermissionsRpc).toHaveBeenCalledWith("Estilista", [
      "appointments.view",
      "customers.manage",
    ]);
  });

  it("rejects unknown permissions before calling the RPC", async () => {
    const deps = makeUpdateDeps();

    const result = await updateRolePermissions(
      {
        role_id: "00000000-0000-0000-0000-000000000001",
        permission_keys: ["not.real"],
      },
      deps
    );

    expect(result).toEqual({
      ok: false,
      error: "Uno o más permisos no son válidos.",
    });
    expect(deps.replaceRolePermissionsRpc).not.toHaveBeenCalled();
  });

  it("maps duplicate role names to a business message", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw { code: "23505", message: "duplicate key" };
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Estilista",
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({
      ok: false,
      error: "Ya existe un rol con ese nombre.",
    });
  });

  it("actualiza los permisos con UNA sola llamada RPC", async () => {
    const deps = makeUpdateDeps();

    const result = await updateRolePermissions(
      {
        role_id: "00000000-0000-4000-8000-000000000001",
        permission_keys: ["reports.view"],
      },
      deps
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deps.replaceRolePermissionsRpc).toHaveBeenCalledTimes(1);
    expect(deps.replaceRolePermissionsRpc).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", [
      "reports.view",
    ]);
  });

  it("deletes roles through the roles adapter", async () => {
    const deps = makeDeleteDeps();

    await expect(deleteSalonRole("salon-1", "role-1", deps)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(deps.findRoleForDelete).toHaveBeenCalledWith("role-1", "salon-1");
    expect(deps.deleteRole).toHaveBeenCalledWith("role-1", "salon-1");
  });

  it("does not delete system roles and reports the domain message", async () => {
    const deps = makeDeleteDeps({
      findRoleForDelete: vi.fn(async () => ({ is_system: true })),
    });

    await expect(deleteSalonRole("salon-1", "role-1", deps)).resolves.toEqual({
      ok: false,
      error: "Los roles de sistema no se pueden eliminar.",
    });
    expect(deps.deleteRole).not.toHaveBeenCalled();
  });

  it("does not delete a role that does not exist in the salon", async () => {
    const deps = makeDeleteDeps({
      findRoleForDelete: vi.fn(async () => null),
    });

    await expect(deleteSalonRole("salon-1", "role-1", deps)).resolves.toEqual({
      ok: false,
      error: "Rol no encontrado.",
    });
    expect(deps.deleteRole).not.toHaveBeenCalled();
  });
});
