import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/infra/result";
import { createCatalogService } from "./create-service";
import { createServiceWithPlan, type ServicePlanGate } from "./create-service-with-plan";
import type { CreateServiceRaw } from "./service-input";

vi.mock("./create-service", () => ({ createCatalogService: vi.fn() }));

const SALON_ID = "00000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "00000000-0000-4000-8000-0000000000cc";
const validRaw: CreateServiceRaw = {
  category_id: CATEGORY_ID,
  name: "Corte",
  description: "",
  duration: { hours: 1, minutes: 0 },
  price: 150,
};

function gate(overrides: Partial<ServicePlanGate> = {}): ServicePlanGate {
  return {
    checkModuleAccess: vi.fn(async () => ok(undefined)),
    checkServiceLimit: vi.fn(async () => ok(undefined)),
    ...overrides,
  };
}

describe("createServiceWithPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createCatalogService).mockResolvedValue(ok("svc-1"));
  });

  it("devuelve el rechazo del módulo sin consultar el cupo ni crear", async () => {
    const plan = gate({ checkModuleAccess: vi.fn(async () => err("Servicios no incluido.")) });

    expect(await createServiceWithPlan(SALON_ID, validRaw, plan)).toEqual(err("Servicios no incluido."));
    expect(plan.checkServiceLimit).not.toHaveBeenCalled();
    expect(createCatalogService).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del cupo sin validar ni crear", async () => {
    const plan = gate({ checkServiceLimit: vi.fn(async () => err("Límite alcanzado.")) });

    expect(await createServiceWithPlan(SALON_ID, validRaw, plan)).toEqual(err("Límite alcanzado."));
    expect(createCatalogService).not.toHaveBeenCalled();
  });

  it("valida la duración después de las puertas del plan", async () => {
    const plan = gate({ checkServiceLimit: vi.fn(async () => err("Límite alcanzado.")) });
    const invalid = { ...validRaw, duration: { hours: 0, minutes: 0 } };

    expect(await createServiceWithPlan(SALON_ID, invalid, plan)).toEqual(err("Límite alcanzado."));
  });

  it("rechaza una entrada inválida cuando el plan lo permite", async () => {
    const result = await createServiceWithPlan(SALON_ID, { ...validRaw, duration: { hours: 0, minutes: 0 } }, gate());

    expect(result.ok).toBe(false);
    expect(createCatalogService).not.toHaveBeenCalled();
  });

  it("crea el servicio con la entrada validada y devuelve su id", async () => {
    const result = await createServiceWithPlan(SALON_ID, validRaw, gate());

    expect(result).toEqual(ok("svc-1"));
    expect(createCatalogService).toHaveBeenCalledWith(SALON_ID, {
      category_id: CATEGORY_ID,
      name: "Corte",
      description: "",
      duration_minutes: 60,
      price: 150,
    });
  });

  it("consulta el módulo y el cupo con el salón recibido", async () => {
    const plan = gate();

    await createServiceWithPlan(SALON_ID, validRaw, plan);

    expect(plan.checkModuleAccess).toHaveBeenCalledWith(SALON_ID);
    expect(plan.checkServiceLimit).toHaveBeenCalledWith(SALON_ID);
  });

  it("propaga el error del caso de uso de creación", async () => {
    vi.mocked(createCatalogService).mockResolvedValue(err("Ya existe un servicio con ese nombre."));

    expect(await createServiceWithPlan(SALON_ID, validRaw, gate())).toEqual(
      err("Ya existe un servicio con ese nombre.")
    );
  });
});
