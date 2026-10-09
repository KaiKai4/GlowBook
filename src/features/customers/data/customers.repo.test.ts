import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  createCustomer,
  deleteCustomer,
  findCustomerByEmail,
  findCustomerByPhone,
  findCustomers,
  updateCustomer,
} from "./customers.repo";

// Todas las consultas de clientes deben quedar acotadas al salon indicado:
// la RLS lo garantiza en BD, pero el repositorio tambien lo pide explicitamente.
const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

const customerRow = {
  id: "cust-1",
  salon_id: SALON_ID,
  first_name: "Ana",
  last_name: "Perez",
  phone: "+50761234567",
  email: "ana@example.com",
  is_temporary: false,
  is_active: true,
};

describe("customers.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("findCustomers", () => {
    it("filtra por salon, excluye temporales y pagina con range", async () => {
      const db = useDb({ customers: { data: [customerRow], error: null, count: 1 } });

      const result = await findCustomers(SALON_ID, { page: 3, perPage: 5 });

      expect(result).toEqual({ data: [customerRow], total: 1 });
      const ops = operationsOn(db, "customers");
      expect(ops).toContainEqual({ target: "customers", method: "eq", args: ["salon_id", SALON_ID] });
      expect(ops).toContainEqual({ target: "customers", method: "eq", args: ["is_temporary", false] });
      expect(ops).toContainEqual({ target: "customers", method: "range", args: [10, 14] });
      expect(ops).toContainEqual({ target: "customers", method: "select", args: ["*", { count: "exact" }] });
    });

    it("usa por defecto la primera pagina de 10 filas", async () => {
      const db = useDb({ customers: { data: [], error: null, count: 0 } });

      await findCustomers(SALON_ID);

      expect(operationsOn(db, "customers")).toContainEqual({
        target: "customers",
        method: "range",
        args: [0, 9],
      });
    });

    it("sanea el termino de busqueda quitando comodines y separadores", async () => {
      const db = useDb({ customers: { data: [], error: null, count: 0 } });

      await findCustomers(SALON_ID, { q: "  ana%_(x),  " });

      const orFilter = operationsOn(db, "customers").find((op) => op.method === "or");
      expect(orFilter?.args).toEqual([
        "search_name.ilike.%anax%,phone.ilike.%anax%,email.ilike.%anax%",
      ]);
    });

    it("no aplica filtro de busqueda si el termino queda vacio tras limpiarlo", async () => {
      const db = useDb({ customers: { data: [], error: null, count: 0 } });

      await findCustomers(SALON_ID, { q: " %_() " });

      expect(operationsOn(db, "customers").some((op) => op.method === "or")).toBe(false);
    });

    it("filtra por estado activo solo cuando se indica", async () => {
      const withFilter = useDb({ customers: { data: [], error: null, count: 0 } });
      await findCustomers(SALON_ID, { isActive: false });
      expect(operationsOn(withFilter, "customers")).toContainEqual({
        target: "customers",
        method: "eq",
        args: ["is_active", false],
      });

      const withoutFilter = useDb({ customers: { data: [], error: null, count: 0 } });
      await findCustomers(SALON_ID);
      expect(
        operationsOn(withoutFilter, "customers").some(
          (op) => op.method === "eq" && op.args[0] === "is_active"
        )
      ).toBe(false);
    });

    it("devuelve lista y total vacios cuando la BD no envia datos ni conteo", async () => {
      useDb({ customers: { data: null, error: null, count: null } });

      expect(await findCustomers(SALON_ID)).toEqual({ data: [], total: 0 });
    });

    it("propaga el error de la consulta", async () => {
      const dbError = { message: "fallo" };
      useDb({ customers: { data: null, error: dbError } });

      await expect(findCustomers(SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("createCustomer", () => {
    it("inserta la fila forzando el salon_id del contexto y devuelve el registro creado", async () => {
      const db = useDb({ customers: { data: customerRow, error: null } });

      const created = await createCustomer(SALON_ID, {
        first_name: "Ana",
        last_name: "Perez",
        phone: "+50761234567",
      });

      expect(created).toEqual(customerRow);
      expect(operationsOn(db, "customers")).toContainEqual({
        target: "customers",
        method: "insert",
        args: [{ first_name: "Ana", last_name: "Perez", phone: "+50761234567", salon_id: SALON_ID }],
      });
    });

    it("propaga el error de insercion", async () => {
      const dbError = { message: "violacion" };
      useDb({ customers: { data: null, error: dbError } });

      await expect(createCustomer(SALON_ID, { first_name: "A", last_name: "B" })).rejects.toBe(
        dbError
      );
    });
  });

  describe("findCustomerByPhone / findCustomerByEmail", () => {
    it("busca por telefono dentro del salon y devuelve el cliente encontrado", async () => {
      const db = useDb({ customers: { data: customerRow, error: null } });

      expect(await findCustomerByPhone(SALON_ID, "+50761234567")).toEqual(customerRow);
      expect(operationsOn(db, "customers")).toEqual([
        { target: "customers", method: "select", args: ["*"] },
        { target: "customers", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "customers", method: "eq", args: ["phone", "+50761234567"] },
        { target: "customers", method: "maybeSingle", args: [] },
      ]);
    });

    it("devuelve null cuando no hay cliente con ese telefono", async () => {
      useDb({ customers: { data: null, error: null } });

      expect(await findCustomerByPhone(SALON_ID, "000")).toBeNull();
    });

    it("busca por email sin distinguir mayusculas y dentro del salon", async () => {
      const db = useDb({ customers: { data: customerRow, error: null } });

      expect(await findCustomerByEmail(SALON_ID, "ANA@example.com")).toEqual(customerRow);
      const ops = operationsOn(db, "customers");
      expect(ops).toContainEqual({ target: "customers", method: "eq", args: ["salon_id", SALON_ID] });
      expect(ops).toContainEqual({
        target: "customers",
        method: "ilike",
        args: ["email", "ANA@example.com"],
      });
    });

    it("devuelve null cuando no hay cliente con ese email", async () => {
      useDb({ customers: { data: null, error: null } });

      expect(await findCustomerByEmail(SALON_ID, "nadie@example.com")).toBeNull();
    });
  });

  describe("deleteCustomer", () => {
    it("solo borra clientes temporales del salon indicado", async () => {
      const db = useDb({ customers: { data: null, error: null } });

      await deleteCustomer("cust-1", SALON_ID);

      expect(operationsOn(db, "customers")).toEqual([
        { target: "customers", method: "delete", args: [] },
        { target: "customers", method: "eq", args: ["id", "cust-1"] },
        { target: "customers", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "customers", method: "eq", args: ["is_temporary", true] },
      ]);
    });

    it("propaga el error de borrado", async () => {
      const dbError = { message: "bloqueado" };
      useDb({ customers: { data: null, error: dbError } });

      await expect(deleteCustomer("cust-1", SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("updateCustomer", () => {
    it("actualiza solo la fila del salon y devuelve el registro actualizado", async () => {
      const db = useDb({ customers: { data: { ...customerRow, notes: "VIP" }, error: null } });

      const updated = await updateCustomer("cust-1", SALON_ID, { notes: "VIP" });

      expect(updated).toMatchObject({ id: "cust-1", notes: "VIP" });
      expect(operationsOn(db, "customers")).toEqual([
        { target: "customers", method: "update", args: [{ notes: "VIP" }] },
        { target: "customers", method: "eq", args: ["id", "cust-1"] },
        { target: "customers", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "customers", method: "select", args: [] },
        { target: "customers", method: "single", args: [] },
      ]);
    });

    it("propaga el error de actualizacion", async () => {
      const dbError = { message: "sin permiso" };
      useDb({ customers: { data: null, error: dbError } });

      await expect(updateCustomer("cust-1", SALON_ID, { notes: "x" })).rejects.toBe(dbError);
    });
  });
});
