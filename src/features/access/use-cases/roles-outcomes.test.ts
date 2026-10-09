import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRole, deleteRole, setRolePermissions } from "../data/roles.repo";
import { PublicError } from "@/lib/public-error";
import { createRoleWithPermissions } from "./create-role";
import { deleteSalonRole } from "./delete-role";
import { updateRolePermissions } from "./update-role-permissions";

// Resultados de los casos de uso de roles: ramas de error y de éxito que el
// tests de roles.test.ts no cubre. Siempre se verifica que el salon_id viaja
// al repositorio, porque es lo que aísla los roles entre salones.

vi.mock("../data/roles.repo", () => ({
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  setRolePermissions: vi.fn(),
}));

const SALON_ID = "salon-1";
const ROLE_ID = "00000000-0000-4000-8000-000000000001";

const mockedCreateRole = vi.mocked(createRole);
const mockedDeleteRole = vi.mocked(deleteRole);
const mockedSetRolePermissions = vi.mocked(setRolePermissions);

describe("createRoleWithPermissions outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("no asigna permisos cuando la lista llega vacía", async () => {
    mockedCreateRole.mockResolvedValue("role-9");

    const result = await createRoleWithPermissions(SALON_ID, {
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: true, value: "role-9" });
    expect(mockedCreateRole).toHaveBeenCalledWith(SALON_ID, "Caja");
    expect(mockedSetRolePermissions).not.toHaveBeenCalled();
  });

  it("rechaza permisos desconocidos antes de crear el rol", async () => {
    const result = await createRoleWithPermissions(SALON_ID, {
      name: "Caja",
      permission_keys: ["reports.view", "inventado.borrar"],
    });

    expect(result).toEqual({ ok: false, error: "Uno o mas permisos no son validos." });
    expect(mockedCreateRole).not.toHaveBeenCalled();
    expect(mockedSetRolePermissions).not.toHaveBeenCalled();
  });

  it("si falla la asignación de permisos, no devuelve el id del rol creado", async () => {
    mockedCreateRole.mockResolvedValue("role-9");
    mockedSetRolePermissions.mockRejectedValue(new Error("fallo"));

    const result = await createRoleWithPermissions(SALON_ID, {
      name: "Caja",
      permission_keys: ["reports.view"],
    });

    expect(result.ok).toBe(false);
  });

  it("clasifica como nombre duplicado un Error cuyo mensaje contiene 'duplicate'", async () => {
    mockedCreateRole.mockRejectedValue(new Error("duplicate key value"));

    const result = await createRoleWithPermissions(SALON_ID, {
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre." });
  });

  it("clasifica como nombre duplicado un error con código 23505 aunque no sea Error", async () => {
    mockedCreateRole.mockRejectedValue({ code: "23505" });

    const result = await createRoleWithPermissions(SALON_ID, {
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Ya existe un rol con ese nombre." });
  });

  it("cualquier otro fallo se devuelve como error genérico", async () => {
    mockedCreateRole.mockRejectedValue(new Error("conexión perdida"));

    const result = await createRoleWithPermissions(SALON_ID, {
      name: "Caja",
      permission_keys: [],
    });

    expect(result).toEqual({ ok: false, error: "Error al crear el rol." });
  });

  it("un valor no Error sin código de unicidad cae en el error genérico", async () => {
    mockedCreateRole.mockRejectedValue("texto suelto");

    const result = await createRoleWithPermissions(SALON_ID, {
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
  it("devuelve error con el mensaje del fallo del adaptador", async () => {
    mockedDeleteRole.mockRejectedValue(new PublicError("Los roles de sistema no se pueden eliminar."));

    const result = await deleteSalonRole(SALON_ID, ROLE_ID);

    expect(result).toEqual({
      ok: false,
      error: "Los roles de sistema no se pueden eliminar.",
    });
  });

  it("un fallo no Error usa el mensaje genérico de eliminación", async () => {
    mockedDeleteRole.mockRejectedValue({ code: "XX" });

    const result = await deleteSalonRole(SALON_ID, ROLE_ID);

    expect(result).toEqual({ ok: false, error: "Error al eliminar el rol." });
  });
});

describe("updateRolePermissions outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("guarda permisos deduplicados para el rol y el salón pedidos", async () => {
    mockedSetRolePermissions.mockResolvedValue(undefined);

    const result = await updateRolePermissions(SALON_ID, {
      role_id: ROLE_ID,
      permission_keys: ["reports.view", "reports.view", "customers.manage"],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedSetRolePermissions).toHaveBeenCalledWith(ROLE_ID, SALON_ID, [
      "reports.view",
      "customers.manage",
    ]);
  });

  it("permite quitar todos los permisos de un rol con lista vacía", async () => {
    mockedSetRolePermissions.mockResolvedValue(undefined);

    const result = await updateRolePermissions(SALON_ID, {
      role_id: ROLE_ID,
      permission_keys: [],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedSetRolePermissions).toHaveBeenCalledWith(ROLE_ID, SALON_ID, []);
  });

  it("cualquier fallo del repositorio se devuelve como error genérico", async () => {
    mockedSetRolePermissions.mockRejectedValue(new Error("Rol no encontrado."));

    const result = await updateRolePermissions(SALON_ID, {
      role_id: ROLE_ID,
      permission_keys: ["reports.view"],
    });

    expect(result).toEqual({ ok: false, error: "Error al actualizar permisos." });
  });
});
