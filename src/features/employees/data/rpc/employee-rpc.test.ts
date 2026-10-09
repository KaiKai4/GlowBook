import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { createEmployeeWithAssignmentsRpc } from "./create-employee-rpc";
import { updateEmployeeProfileRpc } from "./update-employee-rpc";

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createSupabaseServerClient);
const rpc = vi.fn();

const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000d1";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000e1";
const CATEGORY_ID = "00000000-0000-4000-8000-0000000000c1";
const KEY = "00000000-0000-4000-8000-0000000000f1";

function useRpcResponse(response: { data: unknown; error: unknown }): void {
  rpc.mockResolvedValue(response);
  mockedCreateClient.mockResolvedValue({ rpc } as never);
}

describe("adaptadores RPC de colaboradores", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createEmployeeWithAssignmentsRpc", () => {
    const employee = {
      first_name: "Dana",
      last_name: "Nueva",
      phone: "",
      email: "dana@glowbook.test",
      specialty: "",
      commission_percentage: 40,
    };

    it("envia el payload canonico con la clave y devuelve el id del colaborador", async () => {
      useRpcResponse({ data: { employee_id: EMPLOYEE_ID }, error: null });

      await expect(
        createEmployeeWithAssignmentsRpc({
          employee,
          serviceIds: [SERVICE_ID],
          categoryIds: [CATEGORY_ID],
          idempotencyKey: KEY,
        })
      ).resolves.toEqual({ employeeId: EMPLOYEE_ID });

      expect(rpc).toHaveBeenCalledWith("create_employee_with_assignments", {
        payload: {
          employee,
          service_ids: [SERVICE_ID],
          category_ids: [CATEGORY_ID],
          idempotency_key: KEY,
        },
      });
    });

    it("omite hire_date cuando no se envia (no se escribe null por defecto)", async () => {
      useRpcResponse({ data: { employee_id: EMPLOYEE_ID }, error: null });

      await createEmployeeWithAssignmentsRpc({ employee, serviceIds: [], categoryIds: [], idempotencyKey: KEY });

      const payload = rpc.mock.calls[0]?.[1]?.payload as { employee: Record<string, unknown> };
      expect(payload.employee).not.toHaveProperty("hire_date");
    });

    it("propaga el error de PostgREST sin ocultarlo", async () => {
      const error = { code: "23503", message: "fk" };
      useRpcResponse({ data: null, error });

      await expect(
        createEmployeeWithAssignmentsRpc({ employee, serviceIds: [], categoryIds: [], idempotencyKey: KEY })
      ).rejects.toBe(error);
    });

    it("rechaza una respuesta que no cumple el esquema", async () => {
      useRpcResponse({ data: { employee_id: "no-uuid" }, error: null });

      await expect(
        createEmployeeWithAssignmentsRpc({ employee, serviceIds: [], categoryIds: [], idempotencyKey: KEY })
      ).rejects.toThrow("Respuesta inesperada de la RPC create_employee_with_assignments.");
    });
  });

  describe("updateEmployeeProfileRpc", () => {
    it("no envia claves ausentes: un campo no presente no llega a la base", async () => {
      useRpcResponse({ data: { employee_id: EMPLOYEE_ID }, error: null });

      await expect(
        updateEmployeeProfileRpc({
          employeeId: EMPLOYEE_ID,
          fields: { first_name: "Ana Maria" },
          unlinkProfile: false,
          idempotencyKey: KEY,
        })
      ).resolves.toEqual({ employeeId: EMPLOYEE_ID });

      const payload = rpc.mock.calls[0]?.[1]?.payload as Record<string, unknown>;
      expect(rpc).toHaveBeenCalledWith("update_employee_profile", expect.any(Object));
      expect(payload).toEqual({
        employee_id: EMPLOYEE_ID,
        fields: { first_name: "Ana Maria" },
        unlink_profile: false,
        idempotency_key: KEY,
      });
      expect(payload).not.toHaveProperty("service_ids");
      expect(payload).not.toHaveProperty("category_ids");
    });

    it("envía las asignaciones solo cuando se indican", async () => {
      useRpcResponse({ data: { employee_id: EMPLOYEE_ID }, error: null });

      await updateEmployeeProfileRpc({
        employeeId: EMPLOYEE_ID,
        fields: {},
        serviceIds: [],
        categoryIds: [CATEGORY_ID],
        unlinkProfile: true,
        idempotencyKey: KEY,
      });

      const payload = rpc.mock.calls[0]?.[1]?.payload as Record<string, unknown>;
      expect(payload).toMatchObject({ service_ids: [], category_ids: [CATEGORY_ID], unlink_profile: true });
    });

    it("propaga el error de la base", async () => {
      const error = { code: "P0002", message: "Colaborador no encontrado." };
      useRpcResponse({ data: null, error });

      await expect(
        updateEmployeeProfileRpc({
          employeeId: EMPLOYEE_ID,
          fields: { first_name: "X" },
          unlinkProfile: false,
          idempotencyKey: KEY,
        })
      ).rejects.toBe(error);
    });
  });
});
