import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { changeEmployeeRole, type EmployeeRoleDeps } from "./employee-role";
import {
  findAssignableEmployeeRole,
  updateEmployeeProfileRole,
} from "../data/employee-access.repo";

// Solo afecta a las dependencias por defecto (sin fakes): los casos con fakes no los usan.
vi.mock("../data/employee-access.repo", () => ({
  findAssignableEmployeeRole: vi.fn(),
  updateEmployeeProfileRole: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

function fakeRoleDeps() {
  return {
    findAssignableRole: vi.fn<typeof findAssignableEmployeeRole>(),
    updateProfileRole: vi.fn<typeof updateEmployeeProfileRole>(),
  } satisfies Record<keyof EmployeeRoleDeps, unknown>;
}

describe("employee role", () => {
  let deps: ReturnType<typeof fakeRoleDeps>;

  beforeEach(() => {
    deps = fakeRoleDeps();
    deps.findAssignableRole.mockResolvedValue({ data: { id: "role-1" }, error: null });
    deps.updateProfileRole.mockResolvedValue({ error: null });
  });

  it("rejects role assignment when the role does not belong to the salón", async () => {
    deps.findAssignableRole.mockResolvedValue({ data: null, error: null });

    const result = await changeEmployeeRole("salon-1", "profile-1", "foreign-role", deps);

    expect(result.ok).toBe(false);
    expect(deps.updateProfileRole).not.toHaveBeenCalled();
  });

  it("changes role only after validating that the role belongs to the salón", async () => {
    const result = await changeEmployeeRole("salon-1", "profile-1", "role-1", deps);

    expect(result.ok).toBe(true);
    expect(deps.findAssignableRole).toHaveBeenCalledWith("salon-1", "role-1");
    expect(deps.updateProfileRole).toHaveBeenCalledWith("profile-1", "salon-1", "role-1");
  });

  it("si la base rechaza el cambio, devuelve error genérico y registra la causa real", async () => {
    const dbError = new Error("violacion de constraint");
    deps.updateProfileRole.mockResolvedValue({ error: dbError });

    const result = await changeEmployeeRole("salon-1", "profile-1", "role-1", deps);

    expect(result).toEqual({ ok: false, error: "Error al cambiar el rol." });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "employees", action: "access" });
  });

  it("sin dependencias inyectadas usa el repositorio real al cambiar el rol", async () => {
    vi.mocked(updateEmployeeProfileRole).mockResolvedValue({ error: null });

    const result = await changeEmployeeRole("salon-1", "profile-1", null);

    expect(result.ok).toBe(true);
    expect(updateEmployeeProfileRole).toHaveBeenCalledWith("profile-1", "salon-1", null);
  });
});
