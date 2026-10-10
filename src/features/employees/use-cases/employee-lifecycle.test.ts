import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveEmployee, reactivateEmployee } from "./employee-lifecycle";
import { findEmployeeById, updateEmployee } from "../data/employees.repo";
import { clearEmployeeInvitations } from "./employee-invitation-issue";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
  updateEmployee: vi.fn(),
}));

vi.mock("./employee-invitation-issue", () => ({
  clearEmployeeInvitations: vi.fn(),
}));

vi.mock("./employee-revocation", () => ({
  checkEmployeeAccessRevocable: vi.fn(),
  deleteEmployeeAuthAccount: vi.fn(),
}));

const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedUpdateEmployee = vi.mocked(updateEmployee);
const mockedCheckRevocable = vi.mocked(checkEmployeeAccessRevocable);
const mockedClearInvitations = vi.mocked(clearEmployeeInvitations);
const mockedDeleteAuthAccount = vi.mocked(deleteEmployeeAuthAccount);

function employee(overrides: Record<string, unknown> = {}) {
  return {
    id: "employee-1",
    salon_id: "salon-1",
    profile_id: null,
    first_name: "Ana",
    last_name: "Test",
    phone: "",
    email: "ana@example.com",
    specialty: "",
    commission_percentage: 0,
    hire_date: null,
    is_active: true,
    created_at: "2026-05-26T00:00:00.000Z",
    updated_at: "2026-05-26T00:00:00.000Z",
    services: [],
    categories: [],
    work_schedules: [],
    ...overrides,
  };
}

describe("employee lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reactivates an archived collaborator without losing history", async () => {
    mockedFindEmployeeById.mockResolvedValue(employee({ is_active: false }) as never);
    mockedUpdateEmployee.mockResolvedValue(employee() as never);

    const result = await reactivateEmployee("employee-1", "salon-1");

    expect(result.ok).toBe(true);
    expect(mockedUpdateEmployee).toHaveBeenCalledWith("employee-1", "salon-1", {
      is_active: true,
    });
  });

  it("archives a collaborator, checks access, unlinks profile and deletes the account", async () => {
    mockedFindEmployeeById.mockResolvedValue(employee({ profile_id: "profile-1" }) as never);
    mockedCheckRevocable.mockResolvedValue({ ok: true, value: { roleId: null } });
    mockedClearInvitations.mockResolvedValue({ ok: true, value: undefined });
    mockedDeleteAuthAccount.mockResolvedValue({ ok: true, value: undefined });
    mockedUpdateEmployee.mockResolvedValue(employee() as never);

    const result = await archiveEmployee("employee-1", "salon-1");

    expect(result.ok).toBe(true);
    expect(mockedCheckRevocable).toHaveBeenCalledWith("profile-1", "salon-1");
    expect(mockedUpdateEmployee).toHaveBeenCalledWith("employee-1", "salon-1", {
      is_active: false,
      profile_id: null,
    });
    expect(mockedDeleteAuthAccount).toHaveBeenCalledWith("profile-1");
  });

  it("does not archive when the access check fails", async () => {
    mockedFindEmployeeById.mockResolvedValue(employee({ profile_id: "profile-1" }) as never);
    mockedCheckRevocable.mockResolvedValue({
      ok: false,
      error: "No se pudo verificar el acceso actual del colaborador.",
    });

    const result = await archiveEmployee("employee-1", "salon-1");

    expect(result.ok).toBe(false);
    expect(mockedUpdateEmployee).not.toHaveBeenCalled();
    expect(mockedDeleteAuthAccount).not.toHaveBeenCalled();
  });
});
