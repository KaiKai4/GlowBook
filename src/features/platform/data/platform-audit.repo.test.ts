import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPlatformAuditLog } from "./platform-audit.repo";

// Lectura de la auditoria de plataforma: devuelve las filas mas recientes,
// acota el numero de filas y solo aplica filtros exactos. La escritura la
// cubre el modulo audit. El cliente es un doble en memoria que aplica
// eq, order y limit sobre las filas, asi que se comprueba el resultado y no
// la forma de la llamada encadenada.

interface AuditRow {
  id: string;
  action: string;
  status: string;
  created_at: string;
}

interface FakeResult {
  data: AuditRow[] | null;
  error: unknown;
}

const clients = vi.hoisted(() => ({
  rows: [] as AuditRow[],
  error: null as unknown,
  selected: [] as string[],
}));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    const state = {
      rows: clients.rows,
      error: clients.error,
      descending: false,
      max: Infinity,
      filters: [] as Array<[keyof AuditRow, string]>,
    };
    const builder = {
      select: (columns: string) => {
        clients.selected.push(columns);
        return builder;
      },
      order: (_column: string, options: { ascending: boolean }) => {
        state.descending = !options.ascending;
        return builder;
      },
      limit: (count: number) => {
        state.max = count;
        return builder;
      },
      eq: (column: keyof AuditRow, value: string) => {
        state.filters.push([column, value]);
        return builder;
      },
      then: (onFulfilled: (result: FakeResult) => unknown, onRejected?: (reason: unknown) => unknown) => {
        const matching = state.rows.filter((row) =>
          state.filters.every(([column, value]) => row[column] === value)
        );
        const sorted = [...matching].sort((a, b) =>
          state.descending ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)
        );
        const result: FakeResult = state.error
          ? { data: null, error: state.error }
          : { data: sorted.slice(0, state.max), error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return { from: () => builder };
  },
}));

function row(index: number, action: string, status: string): AuditRow {
  const minute = String(index).padStart(4, "0");
  return {
    id: `audit-${index}`,
    action,
    status,
    created_at: `2026-01-01T00:${minute.slice(0, 2)}:${minute.slice(2)}Z`,
  };
}

beforeEach(() => {
  clients.error = null;
  clients.selected = [];
  clients.rows = Array.from({ length: 250 }, (_, index) =>
    row(index, index % 2 === 0 ? "delete_salon" : "update_salon_status", index % 3 === 0 ? "failed" : "succeeded")
  );
});

describe("findPlatformAuditLog", () => {
  it("selects only the columns the Platform view needs", async () => {
    await findPlatformAuditLog();

    expect(clients.selected).toEqual([
      "id, actor_user_id, action, status, target_salon_id, target_resource_type, target_resource_id, metadata, error_message, created_at",
    ]);
  });

  it("returns the newest 100 rows, most recent first, when no filter is given", async () => {
    const rows = await findPlatformAuditLog();

    expect(rows).toHaveLength(100);
    expect(rows[0]?.id).toBe("audit-249");
    expect(rows[99]?.id).toBe("audit-150");
  });

  it("returns only the rows that match both the action and the status", async () => {
    const rows = await findPlatformAuditLog({ action: "delete_salon", status: "failed" });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((entry) => entry.action === "delete_salon" && entry.status === "failed")).toBe(true);
    expect(rows[0]?.id).toBe("audit-246");
  });

  it("clamps the requested limit into the 1..200 range", async () => {
    expect(await findPlatformAuditLog({ limit: 0 })).toHaveLength(1);
    expect(await findPlatformAuditLog({ limit: 5000 })).toHaveLength(200);
    expect(await findPlatformAuditLog({ limit: 25 })).toHaveLength(25);
  });

  it("returns an empty list when the adapter returns no data", async () => {
    clients.rows = [];

    await expect(findPlatformAuditLog()).resolves.toEqual([]);
  });

  it("throws the adapter error unchanged when the read fails", async () => {
    const readError = { message: "denied" };
    clients.error = readError;

    await expect(findPlatformAuditLog()).rejects.toBe(readError);
  });
});
