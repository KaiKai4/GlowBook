import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeEmployeeRole,
  replacePendingEmployeeInvitation,
  resetEmployeeAccess,
} from "./employee-access";
import { findEmployeeById } from "../data/employees.repo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

type QueryRecord = {
  table: string;
  operation?: "delete" | "update" | "insert" | "select";
  filters: Array<[string, unknown]>;
  nullFilters: Array<[string, null]>;
  payload?: unknown;
};

const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);

let roleLookup: { data: { id: string } | null; error: null | Error };
let profileLookup: { data: { role_id?: string | null; is_owner?: boolean } | null; error: null | Error };
let deleteUserError: null | { status?: number; message: string };
let insertError: null | Error;
let records: QueryRecord[];

function createAdminMock() {
  return {
    from: vi.fn((table: string) => {
      const record: QueryRecord = { table, filters: [], nullFilters: [] };
      records.push(record);

      const query = {
        select: vi.fn(() => {
          record.operation = "select";
          return query;
        }),
        delete: vi.fn(() => {
          record.operation = "delete";
          return query;
        }),
        update: vi.fn((payload: unknown) => {
          record.operation = "update";
          record.payload = payload;
          return query;
        }),
        insert: vi.fn(async (payload: unknown) => {
          record.operation = "insert";
          record.payload = payload;
          return { error: insertError };
        }),
        eq: vi.fn((column: string, value: unknown) => {
          record.filters.push([column, value]);
          return query;
        }),
        is: vi.fn((column: string, value: null) => {
          record.nullFilters.push([column, value]);
          return query;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "roles") return roleLookup;
          if (table === "profiles") return profileLookup;
          return { data: null, error: null };
        }),
      };

      return query;
    }),
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ error: deleteUserError })),
      },
    },
  };
}

describe("employee access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    roleLookup = { data: { id: "role-1" }, error: null };
    profileLookup = { data: { role_id: "role-1", is_owner: false }, error: null };
    deleteUserError = null;
    insertError = null;
    records = [];
    mockedCreateSupabaseAdminClient.mockReturnValue(createAdminMock() as never);
  });

  it("rejects role assignment when the role does not belong to the salon", async () => {
    roleLookup = { data: null, error: null };

    const result = await changeEmployeeRole("salon-1", "profile-1", "foreign-role");

    expect(result.ok).toBe(false);
    expect(records.some((record) => record.table === "profiles" && record.operation === "update")).toBe(false);
  });

  it("changes role only after validating that the role belongs to the salon", async () => {
    const result = await changeEmployeeRole("salon-1", "profile-1", "role-1");

    expect(result.ok).toBe(true);
    const roleQuery = records.find((record) => record.table === "roles");
    expect(roleQuery?.filters).toEqual([
      ["id", "role-1"],
      ["salon_id", "salon-1"],
      ["is_system", false],
    ]);
    const profileUpdate = records.find((record) => record.table === "profiles" && record.operation === "update");
    expect(profileUpdate?.payload).toEqual({ role_id: "role-1" });
    expect(profileUpdate?.filters).toEqual([
      ["id", "profile-1"],
      ["salon_id", "salon-1"],
    ]);
  });

  it("replaces pending invitations and stores only a validated role id", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00.000Z"));

    const result = await replacePendingEmployeeInvitation({
      employeeId: "employee-1",
      salonId: "salon-1",
      email: "staff@example.com",
      roleId: "role-1",
    });

    expect(result.ok).toBe(true);
    const deletedInvite = records.find((record) => record.table === "employee_invitations" && record.operation === "delete");
    expect(deletedInvite?.filters).toEqual([
      ["employee_id", "employee-1"],
      ["salon_id", "salon-1"],
    ]);
    expect(deletedInvite?.nullFilters).toEqual([["accepted_at", null]]);

    const insertedInvite = records.find((record) => record.table === "employee_invitations" && record.operation === "insert");
    expect(insertedInvite?.payload).toMatchObject({
      employee_id: "employee-1",
      salon_id: "salon-1",
      email: "staff@example.com",
      role_id: "role-1",
      expires_at: "2026-06-02T12:00:00.000Z",
    });

    vi.useRealTimers();
  });

  it("resets access by deleting the old auth user and creating a fresh invitation", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      id: "employee-1",
      salon_id: "salon-1",
      profile_id: "profile-1",
      email: "staff@example.com",
      first_name: "Ana",
      last_name: "Test",
      is_active: true,
    } as never);

    const result = await resetEmployeeAccess({
      employeeId: "employee-1",
      salonId: "salon-1",
      roleId: null,
    });

    expect(result.ok).toBe(true);
    const employeeUnlink = records.find((record) => record.table === "employees" && record.operation === "update");
    expect(employeeUnlink?.payload).toEqual({ profile_id: null });
    const insertedInvite = records.find((record) => record.table === "employee_invitations" && record.operation === "insert");
    expect(insertedInvite?.payload).toMatchObject({
      employee_id: "employee-1",
      salon_id: "salon-1",
      email: "staff@example.com",
      role_id: "role-1",
    });
  });
});
