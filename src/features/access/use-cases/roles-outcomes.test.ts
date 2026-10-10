import { captureError } from "@/infra/observability";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRole, findRoleForDelete } from "../data/roles.repo";
import {
  createRoleWithPermissionsRpc,
  replaceRolePermissionsRpc,
} from "../data/rpc/role-permissions-rpc";
import { createRoleWithPermissions } from "./create-role";
import { deleteSalonRole } from "./delete-role";
import { updateRolePermissions } from "./update-role-permissions";

// Resultados de los casos de uso de roles: ramas de error y de éxito. Siempre se verifica que el
// salon_id viaja al adaptador, porque es lo que aísla los roles entre salones.

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

vi.mock("../data/roles.repo", () => ({
  deleteRole: vi.fn(),
  findRoleForDelete: vi.fn(),
}));

vi.mock("../data/rpc/role-permissions-rpc", () => ({
  createRoleWithPermissionsRpc: vi.fn(),
  replaceRolePermissionsRpc: vi.fn(),
}));

const SALON_ID = "salon-1";
const ROLE_ID = "00000000-0000-4000-8000-000000000001";

const mockedDeleteRole = vi.mocked(deleteRole);
const mockedFindRoleForDelete = vi.mocked(findRoleForDelete);
const mockedCreateRpc = vi.mocked(createRoleWithPermissionsRpc);
const mockedReplaceRpc = vi.mocked(replaceRolePermissionsRpc);

describe("createRoleWithPermissions outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("crea el rol sin permisos cuando la lista llega vacía, en una sola llamada", async () => {
    mockedCreateRpc.mockResolvedValue("role-9");

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: true, value: "role-9" });
    expect(mockedCreateRpc).toHaveBeenCalledTimes(1);
    expect(mockedCreateRpc).toHaveBeenCalledWith("Caja", []);
  });

  it("rechaza permisos desconocidos antes de llamar a la RPC", async () => {
    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: ["reports.view", "inventado.borrar"],
    });

    expect(result).toEqual({ ok: false, error: "Uno o más permisos no son válidos." });
    expect(mockedCreateRpc).not.toHaveBeenCalled();
  });

  it("si la RPC falla, no devuelve ningún id de rol", async () => {
    mockedCreateRpc.mockRejectedValue(new Error("fallo"));

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: ["reports.view"],
    });

    expect(result.ok).toBe(false);
  });

  it("clasifica como nombre duplicado un Error cuyo mensaje contiene 'duplicate'", async () => {
    mockedCreateRpc.mockRejectedValue(new Error("duplicate key value"));

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre." });
  });

  it("clasifica como nombre duplicado un error con código 23505 aunque no sea Error", async () => {
    mockedCreateRpc.mockRejectedValue({ code: "23505" });

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre." });
  });

  it("traduce 42501 de la RPC a un mensaje fijo de permisos", async () => {
    mockedCreateRpc.mockRejectedValue({ code: "42501", message: "No tienes permiso para gestionar roles." });

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: ["reports.view"],
    });

    expect(result).toEqual({ ok: false, error: "No tienes permiso para gestionar roles." });
  });

  it("traduce 22023 de la RPC (clave inexistente) a un mensaje fijo", async () => {
    mockedCreateRpc.mockRejectedValue({ code: "22023", message: "Uno o más permisos no existen." });

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: ["reports.view"],
    });

    expect(result).toEqual({ ok: false, error: "Uno o más permisos no son válidos." });
  });

  it("cualquier otro fallo se devuelve como error genérico", async () => {
    mockedCreateRpc.mockRejectedValue(new Error("conexión perdida"));

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Error al crear el rol." });
  });

  it("un valor no Error sin código de unicidad cae en el error genérico", async () => {
    mockedCreateRpc.mockRejectedValue("texto suelto");

    const result = await createRoleWithPermissions({
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Error al crear el rol." });
  });
});

describe("deleteSalonRole outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // delete-role.ts usa toPublicErrorMessage: solo PublicError llega a la UI.
  it("devuelve error si el rol es de sistema, sin llamar al borrado", async () => {
    mockedFindRoleForDelete.mockResolvedValue({ is_system: true });

    const result = await deleteSalonRole(SALON_ID, ROLE_ID);

    expect(result).toEqual({
      ok: false,
      error: "Los roles de sistema no se pueden eliminar.",
    });
  });

  it("un fallo no Error usa el mensaje genérico de eliminación", async () => {
    mockedFindRoleForDelete.mockResolvedValue({ is_system: false });
    mockedDeleteRole.mockRejectedValue({ code: "XX" });

    const result = await deleteSalonRole(SALON_ID, ROLE_ID);

    expect(result).toEqual({ ok: false, error: "Error al eliminar el rol." });
  });
});

describe("updateRolePermissions outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("guarda permisos deduplicados en una sola llamada RPC", async () => {
    mockedReplaceRpc.mockResolvedValue(undefined);

    const result = await updateRolePermissions({
      role_id: ROLE_ID,
      permission_keys: ["reports.view", "reports.view", "customers.manage"],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedReplaceRpc).toHaveBeenCalledTimes(1);
    expect(mockedReplaceRpc).toHaveBeenCalledWith(ROLE_ID, ["reports.view", "customers.manage"]);
  });

  it("permite quitar todos los permisos de un rol con lista vacía", async () => {
    mockedReplaceRpc.mockResolvedValue(undefined);

    const result = await updateRolePermissions({
      role_id: ROLE_ID,
      permission_keys: [],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedReplaceRpc).toHaveBeenCalledWith(ROLE_ID, []);
  });

  it("traduce 42501 y P0002 de la RPC a mensajes fijos", async () => {
    mockedReplaceRpc.mockRejectedValueOnce({ code: "42501" });
    mockedReplaceRpc.mockRejectedValueOnce({ code: "P0002" });

    await expect(
      updateRolePermissions({ role_id: ROLE_ID, permission_keys: ["reports.view"] })
    ).resolves.toEqual({ ok: false, error: "No tienes permiso para gestionar roles." });
    await expect(
      updateRolePermissions({ role_id: ROLE_ID, permission_keys: ["reports.view"] })
    ).resolves.toEqual({ ok: false, error: "Rol no encontrado." });
  });

  it("cualquier otro fallo de la RPC se devuelve como error genérico", async () => {
    mockedReplaceRpc.mockRejectedValue(new Error("Rol no encontrado."));

    const result = await updateRolePermissions({
      role_id: ROLE_ID,
      permission_keys: ["reports.view"],
    });

    expect(result).toEqual({ ok: false, error: "Error al actualizar permisos." });
  });
});

describe("registro de errores de permisos de rol", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("registra con captureError el fallo inesperado al guardar permisos", async () => {
    const dbError = new Error("caida");
    mockedReplaceRpc.mockRejectedValue(dbError);

    expect(await updateRolePermissions({ role_id: "role-1", permission_keys: [] })).toEqual({
      ok: false,
      error: "Error al actualizar permisos.",
    });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "access", action: "update_role_permissions" });
  });
});
