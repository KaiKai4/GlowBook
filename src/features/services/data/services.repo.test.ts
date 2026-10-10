import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseDouble,
  operationsOn,
  type SupabaseDouble,
} from "@/test/small-features-supabase";
import {
  archiveCategory,
  createCategory,
  createService,
  findCategoriesWithServices,
  findServicesCatalog,
  updateCategory,
  updateService,
} from "./services.repo";

const serverClient = vi.hoisted(() => ({ current: null as SupabaseDouble | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const SALON_ID = "salon-1";

function useDb(script: Parameters<typeof createSupabaseDouble>[0] = {}): SupabaseDouble {
  const db = createSupabaseDouble(script);
  serverClient.current = db;
  return db;
}

describe("services.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClient.current = null;
  });

  describe("lecturas del catalogo", () => {
    it("findCategoriesWithServices trae categorias activas con sus servicios ordenadas", async () => {
      const db = useDb({ service_categories: { data: [{ id: "cat-1" }], error: null } });

      expect(await findCategoriesWithServices(SALON_ID)).toEqual([{ id: "cat-1" }]);
      expect(operationsOn(db, "service_categories")).toEqual([
        { target: "service_categories", method: "select", args: ["*, services(*)"] },
        { target: "service_categories", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "service_categories", method: "eq", args: ["is_active", true] },
        { target: "service_categories", method: "order", args: ["ordering", { ascending: true }] },
      ]);
    });

    it("findServicesCatalog incluye empleados asignados a cada servicio y filtra por salon", async () => {
      const db = useDb({ service_categories: { data: [{ id: "cat-1", services: [] }], error: null } });

      expect(await findServicesCatalog(SALON_ID)).toEqual([{ id: "cat-1", services: [] }]);
      const [select, salonFilter] = operationsOn(db, "service_categories");
      expect(select?.args[0]).toContain("employee_services(employee:employees(id, first_name, last_name, is_active))");
      expect(salonFilter).toEqual({ target: "service_categories", method: "eq", args: ["salon_id", SALON_ID] });
    });

    it.each([
      ["findCategoriesWithServices", () => findCategoriesWithServices(SALON_ID)],
      ["findServicesCatalog", () => findServicesCatalog(SALON_ID)],
    ])("%s devuelve lista vacia sin datos y propaga errores", async (_label, run) => {
      useDb({ service_categories: { data: null, error: null } });
      expect(await run()).toEqual([]);

      const dbError = { message: "fallo" };
      useDb({ service_categories: { data: null, error: dbError } });
      await expect(run()).rejects.toBe(dbError);
    });
  });

  describe("categorias", () => {
    it("createCategory inserta con el salon del contexto y devuelve la fila creada", async () => {
      const db = useDb({ service_categories: { data: { id: "cat-1" }, error: null } });

      expect(await createCategory(SALON_ID, { name: "Corte", ordering: 1 })).toEqual({ id: "cat-1" });
      expect(operationsOn(db, "service_categories")).toEqual([
        { target: "service_categories", method: "insert", args: [{ name: "Corte", ordering: 1, salon_id: SALON_ID }] },
        { target: "service_categories", method: "select", args: [] },
        { target: "service_categories", method: "single", args: [] },
      ]);
    });

    it("updateCategory actualiza solo la categoria del salon indicado", async () => {
      const db = useDb({ service_categories: { data: { id: "cat-1", name: "Color" }, error: null } });

      expect(await updateCategory("cat-1", SALON_ID, { name: "Color" })).toEqual({ id: "cat-1", name: "Color" });
      expect(operationsOn(db, "service_categories")).toEqual([
        { target: "service_categories", method: "update", args: [{ name: "Color" }] },
        { target: "service_categories", method: "eq", args: ["id", "cat-1"] },
        { target: "service_categories", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "service_categories", method: "select", args: [] },
        { target: "service_categories", method: "single", args: [] },
      ]);
    });

    it("archiveCategory desactiva solo categorias activas del salon", async () => {
      const db = useDb({ service_categories: { data: { id: "cat-1" }, error: null } });

      expect(await archiveCategory("cat-1", SALON_ID)).toEqual({ id: "cat-1" });
      expect(operationsOn(db, "service_categories")).toEqual([
        { target: "service_categories", method: "update", args: [{ is_active: false }] },
        { target: "service_categories", method: "eq", args: ["id", "cat-1"] },
        { target: "service_categories", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "service_categories", method: "eq", args: ["is_active", true] },
        { target: "service_categories", method: "select", args: ["id"] },
        { target: "service_categories", method: "single", args: [] },
      ]);
    });

    it("las escrituras de categorias propagan errores", async () => {
      const dbError = { message: "fallo" };
      useDb({ service_categories: { data: null, error: dbError } });
      await expect(createCategory(SALON_ID, { name: "Corte", ordering: 1 })).rejects.toBe(dbError);

      useDb({ service_categories: { data: null, error: dbError } });
      await expect(updateCategory("cat-1", SALON_ID, { name: "x" })).rejects.toBe(dbError);

      useDb({ service_categories: { data: null, error: dbError } });
      await expect(archiveCategory("cat-1", SALON_ID)).rejects.toBe(dbError);
    });
  });

  describe("servicios", () => {
    it("createService verifica que la categoria pertenezca al salon antes de insertar", async () => {
      const db = useDb({
        service_categories: { data: { id: "cat-1" }, error: null },
        services: { data: { id: "svc-1" }, error: null },
      });

      expect(
        await createService(SALON_ID, { name: "Corte", category_id: "cat-1", duration_minutes: 30, price: 10 })
      ).toEqual({ id: "svc-1" });

      expect(operationsOn(db, "service_categories")).toEqual([
        { target: "service_categories", method: "select", args: ["id"] },
        { target: "service_categories", method: "eq", args: ["id", "cat-1"] },
        { target: "service_categories", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "service_categories", method: "eq", args: ["is_active", true] },
        { target: "service_categories", method: "maybeSingle", args: [] },
      ]);
      expect(operationsOn(db, "services")).toContainEqual({
        target: "services",
        method: "insert",
        args: [{ name: "Corte", category_id: "cat-1", duration_minutes: 30, price: 10, salon_id: SALON_ID }],
      });
    });

    it("createService rechaza categorias de otro salon o inactivas sin insertar el servicio", async () => {
      const db = useDb({ service_categories: { data: null, error: null } });

      await expect(
        createService(SALON_ID, { name: "Corte", category_id: "cat-ajena", duration_minutes: 30, price: 10 })
      ).rejects.toThrow("La categoría no pertenece al salón.");
      expect(operationsOn(db, "services")).toEqual([]);
    });

    it("createService propaga el error de insercion del servicio", async () => {
      const dbError = { message: "fallo" };
      useDb({
        service_categories: { data: { id: "cat-1" }, error: null },
        services: { data: null, error: dbError },
      });

      await expect(
        createService(SALON_ID, { name: "Corte", category_id: "cat-1", duration_minutes: 30, price: 10 })
      ).rejects.toBe(dbError);
    });

    it("updateService sin cambio de categoria actualiza directamente el servicio del salon", async () => {
      const db = useDb({ services: { data: { id: "svc-1" }, error: null } });

      expect(await updateService("svc-1", SALON_ID, { price: 15 })).toEqual({ id: "svc-1" });
      expect(operationsOn(db, "service_categories")).toEqual([]);
      expect(operationsOn(db, "services")).toEqual([
        { target: "services", method: "update", args: [{ price: 15 }] },
        { target: "services", method: "eq", args: ["id", "svc-1"] },
        { target: "services", method: "eq", args: ["salon_id", SALON_ID] },
        { target: "services", method: "select", args: [] },
        { target: "services", method: "single", args: [] },
      ]);
    });

    it("updateService valida que la nueva categoria este activa y sea del salon", async () => {
      const db = useDb({
        service_categories: { data: { id: "cat-2" }, error: null },
        services: { data: { id: "svc-1" }, error: null },
      });

      await updateService("svc-1", SALON_ID, { category_id: "cat-2" });

      expect(operationsOn(db, "service_categories")).toContainEqual({
        target: "service_categories",
        method: "eq",
        args: ["salon_id", SALON_ID],
      });
      expect(operationsOn(db, "service_categories")).toContainEqual({
        target: "service_categories",
        method: "eq",
        args: ["is_active", true],
      });
    });

    it("updateService rechaza una categoria nueva inexistente, ajena o inactiva", async () => {
      const db = useDb({ service_categories: { data: null, error: null } });

      await expect(updateService("svc-1", SALON_ID, { category_id: "cat-x" })).rejects.toThrow(
        "La categoría no pertenece al salón o está inactiva."
      );
      expect(operationsOn(db, "services").some((op) => op.method === "update")).toBe(false);
    });

    it("updateService propaga el error de actualizacion", async () => {
      const dbError = { message: "fallo" };
      useDb({ services: { data: null, error: dbError } });

      await expect(updateService("svc-1", SALON_ID, { price: 1 })).rejects.toBe(dbError);
    });
  });
});
