import { captureError } from "@/infra/observability";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoleWithPermissions, type CreateRoleWithPermissionsDeps } from "./create-role";
import { deleteSalonRole, type DeleteSalonRoleDeps } from "./delete-role";
import { updateRolePermissions, type UpdateRolePermissionsDeps } from "./update-role-permissions";

// Resultados de los casos de uso de roles: ramas de error y de éxito. Siempre se verifica que el
// salon_id viaja al adaptador, porque es lo que aísla los roles entre salones.
// Las dependencias son fakes tipados (ADR 0028); solo captureError sigue mockeado (infra transversal).

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const SALON_ID = "salon-1";
const ROLE_ID = "00000000-0000-4000-8000-000000000001";

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

const mockedCaptureError = vi.mocked(captureError);

describe("createRoleWithPermissions outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea el rol sin permisos cuando la lista llega vacía, en una sola llamada", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => "role-9"),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({ ok: true, value: "role-9" });
    expect(deps.createRoleWithPermissionsRpc).toHaveBeenCalledTimes(1);
    expect(deps.createRoleWithPermissionsRpc).toHaveBeenCalledWith("Caja", []);
  });

  it("rechaza permisos desconocidos antes de llamar a la RPC", async () => {
    const deps = makeCreateDeps();

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: ["reports.view", "inventado.borrar"],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Uno o más permisos no son válidos." });
    expect(deps.createRoleWithPermissionsRpc).not.toHaveBeenCalled();
  });

  it("si la RPC falla, no devuelve ningún id de rol", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw new Error("fallo");
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: ["reports.view"],
      },
      deps
    );

    expect(result.ok).toBe(false);
  });

  it("clasifica como nombre duplicado un Error cuyo mensaje contiene 'duplicate'", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw new Error("duplicate key value");
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre." });
  });

  it("clasifica como nombre duplicado un error con código 23505 aunque no sea Error", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw { code: "23505" };
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre." });
  });

  it("traduce 42501 de la RPC a un mensaje fijo de permisos", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw { code: "42501", message: "No tienes permiso para gestionar roles." };
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: ["reports.view"],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "No tienes permiso para gestionar roles." });
  });

  it("traduce 22023 de la RPC (clave inexistente) a un mensaje fijo", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw { code: "22023", message: "Uno o más permisos no existen." };
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: ["reports.view"],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Uno o más permisos no son válidos." });
  });

  it("cualquier otro fallo se devuelve como error genérico", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw new Error("conexión perdida");
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Error al crear el rol." });
  });

  it("un valor no Error sin código de unicidad cae en el error genérico", async () => {
    const deps = makeCreateDeps({
      createRoleWithPermissionsRpc: vi.fn(async () => {
        throw "texto suelto";
      }),
    });

    const result = await createRoleWithPermissions(
      {
        name: "Caja",
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Error al crear el rol." });
  });
});

describe("deleteSalonRole outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // delete-role.ts usa toPublicErrorMessage: solo PublicError llega a la UI.
  it("devuelve error si el rol es de sistema, sin llamar al borrado", async () => {
    const deps = makeDeleteDeps({
      findRoleForDelete: vi.fn(async () => ({ is_system: true })),
    });

    const result = await deleteSalonRole(SALON_ID, ROLE_ID, deps);

    expect(result).toEqual({
      ok: false,
      error: "Los roles de sistema no se pueden eliminar.",
    });
    expect(deps.deleteRole).not.toHaveBeenCalled();
  });

  it("un fallo no Error usa el mensaje genérico de eliminación", async () => {
    const deps = makeDeleteDeps({
      deleteRole: vi.fn(async () => {
        throw { code: "XX" };
      }),
    });

    const result = await deleteSalonRole(SALON_ID, ROLE_ID, deps);

    expect(result).toEqual({ ok: false, error: "Error al eliminar el rol." });
  });
});

describe("updateRolePermissions outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda permisos deduplicados en una sola llamada RPC", async () => {
    const deps = makeUpdateDeps();

    const result = await updateRolePermissions(
      {
        role_id: ROLE_ID,
        permission_keys: ["reports.view", "reports.view", "customers.manage"],
      },
      deps
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deps.replaceRolePermissionsRpc).toHaveBeenCalledTimes(1);
    expect(deps.replaceRolePermissionsRpc).toHaveBeenCalledWith(ROLE_ID, ["reports.view", "customers.manage"]);
  });

  it("permite quitar todos los permisos de un rol con lista vacía", async () => {
    const deps = makeUpdateDeps();

    const result = await updateRolePermissions(
      {
        role_id: ROLE_ID,
        permission_keys: [],
      },
      deps
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deps.replaceRolePermissionsRpc).toHaveBeenCalledWith(ROLE_ID, []);
  });

  it("traduce 42501 y P0002 de la RPC a mensajes fijos", async () => {
    const deps = makeUpdateDeps({
      replaceRolePermissionsRpc: vi
        .fn<UpdateRolePermissionsDeps["replaceRolePermissionsRpc"]>()
        .mockRejectedValueOnce({ code: "42501" })
        .mockRejectedValueOnce({ code: "P0002" }),
    });

    await expect(
      updateRolePermissions({ role_id: ROLE_ID, permission_keys: ["reports.view"] }, deps)
    ).resolves.toEqual({ ok: false, error: "No tienes permiso para gestionar roles." });
    await expect(
      updateRolePermissions({ role_id: ROLE_ID, permission_keys: ["reports.view"] }, deps)
    ).resolves.toEqual({ ok: false, error: "Rol no encontrado." });
  });

  it("cualquier otro fallo de la RPC se devuelve como error genérico", async () => {
    const deps = makeUpdateDeps({
      replaceRolePermissionsRpc: vi.fn(async () => {
        throw new Error("Rol no encontrado.");
      }),
    });

    const result = await updateRolePermissions(
      {
        role_id: ROLE_ID,
        permission_keys: ["reports.view"],
      },
      deps
    );

    expect(result).toEqual({ ok: false, error: "Error al actualizar permisos." });
  });
});

describe("registro de errores de permisos de rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra con captureError el fallo inesperado al guardar permisos", async () => {
    const dbError = new Error("caida");
    const deps = makeUpdateDeps({
      replaceRolePermissionsRpc: vi.fn(async () => {
        throw dbError;
      }),
    });

    expect(await updateRolePermissions({ role_id: "role-1", permission_keys: [] }, deps)).toEqual({
      ok: false,
      error: "Error al actualizar permisos.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(dbError, { module: "access", action: "update_role_permissions" });
  });
});
