import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveEmployee, reactivateEmployee, type EmployeeLifecycleDeps } from "./employee-lifecycle";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import { clearEmployeeInvitations } from "./employee-invitation-issue";

function fakeLifecycleDeps() {
  return {
    findEmployee: vi.fn<EmployeeLifecycleDeps["findEmployee"]>(),
    updateEmployee: vi.fn<EmployeeLifecycleDeps["updateEmployee"]>(),
    clearInvitations: vi.fn<typeof clearEmployeeInvitations>(),
    checkAccessRevocable: vi.fn<typeof checkEmployeeAccessRevocable>(),
    deleteAuthAccount: vi.fn<typeof deleteEmployeeAuthAccount>(),
  } satisfies Record<keyof EmployeeLifecycleDeps, unknown>;
}

describe("employee lifecycle", () => {
  let deps: ReturnType<typeof fakeLifecycleDeps>;

  beforeEach(() => {
    deps = fakeLifecycleDeps();
  });

  it("reactivates an archived collaborator without losing history", async () => {
    deps.findEmployee.mockResolvedValue({ profile_id: null });
    deps.updateEmployee.mockResolvedValue({});

    const result = await reactivateEmployee("employee-1", "salon-1", deps);

    expect(result.ok).toBe(true);
    expect(deps.updateEmployee).toHaveBeenCalledWith("employee-1", "salon-1", {
      is_active: true,
    });
  });

  it("archives a collaborator, checks access, unlinks profile and deletes the account", async () => {
    deps.findEmployee.mockResolvedValue({ profile_id: "profile-1" });
    deps.checkAccessRevocable.mockResolvedValue({ ok: true, value: { roleId: null } });
    deps.clearInvitations.mockResolvedValue({ ok: true, value: undefined });
    deps.deleteAuthAccount.mockResolvedValue({ ok: true, value: undefined });
    deps.updateEmployee.mockResolvedValue({});

    const result = await archiveEmployee("employee-1", "salon-1", deps);

    expect(result.ok).toBe(true);
    expect(deps.checkAccessRevocable).toHaveBeenCalledWith("profile-1", "salon-1");
    expect(deps.updateEmployee).toHaveBeenCalledWith("employee-1", "salon-1", {
      is_active: false,
      profile_id: null,
    });
    expect(deps.deleteAuthAccount).toHaveBeenCalledWith("profile-1");
  });

  it("does not archive when the access check fails", async () => {
    deps.findEmployee.mockResolvedValue({ profile_id: "profile-1" });
    deps.checkAccessRevocable.mockResolvedValue({
      ok: false,
      error: "No se pudo verificar el acceso actual del colaborador.",
    });

    const result = await archiveEmployee("employee-1", "salon-1", deps);

    expect(result.ok).toBe(false);
    expect(deps.updateEmployee).not.toHaveBeenCalled();
    expect(deps.deleteAuthAccount).not.toHaveBeenCalled();
  });
});
