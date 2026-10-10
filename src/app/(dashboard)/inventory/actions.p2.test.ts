import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import {
  createInventoryProduct,
  deleteInventoryProduct,
  updateInventoryProductProfile,
} from "@/features/inventory/use-cases/inventory-products";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID } from "@/test/action-fixtures";
import {
  createInventoryProductAction,
  deleteInventoryProductAction,
  updateInventoryProductAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/inventory-products", () => ({
  createInventoryProduct: vi.fn(),
  deleteInventoryProduct: vi.fn(),
  getInventoryPage: vi.fn(),
  updateInventoryProductProfile: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/inventory-movements", () => ({
  transferInventoryStock: vi.fn(),
}));

const INVALID = { ok: false, error: "Identificador inválido." } as const;
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.INVENTORY_MANAGE] });

describe("inventory actions: identificadores, límite y permisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("niega crear producto sin permiso de inventario y sin consumir límite", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile({ permissions: [PERMISSIONS.RETAIL_MANAGE] }));

    expect(await createInventoryProductAction(null, formDataOf({ name: "Shampoo" }))).toEqual({
      ok: false,
      error: "No tienes permiso para gestionar inventario.",
    });
    expect(assertActionRateLimit).not.toHaveBeenCalled();
    expect(createInventoryProduct).not.toHaveBeenCalled();
  });

  it("devuelve el bloqueo del límite al crear producto", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await createInventoryProductAction(null, formDataOf({ name: "Shampoo" }))).toEqual(RATE_LIMITED);
    expect(createInventoryProduct).not.toHaveBeenCalled();
  });

  it("aplica 60 peticiones por minuto en el ámbito inventory", async () => {
    vi.mocked(createInventoryProduct).mockResolvedValue(ok(undefined));

    await createInventoryProductAction(null, formDataOf({ name: "Shampoo" }));

    expect(assertActionRateLimit).toHaveBeenCalledWith(manager.id, "inventory", { max: 60, windowMs: 60_000 });
  });

  it("updateInventoryProductAction rechaza un identificador inválido antes de validar el formulario", async () => {
    expect(await updateInventoryProductAction("producto", null, formDataOf({ name: "Shampoo" }))).toEqual(INVALID);
    expect(updateInventoryProductProfile).not.toHaveBeenCalled();
  });

  it("updateInventoryProductAction devuelve el bloqueo del límite sin actualizar", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await updateInventoryProductAction(RECORD_ID, null, formDataOf({ name: "Shampoo" }))).toEqual(
      RATE_LIMITED
    );
    expect(updateInventoryProductProfile).not.toHaveBeenCalled();
  });

  it("updateInventoryProductAction no revalida cuando el caso de uso falla", async () => {
    vi.mocked(updateInventoryProductProfile).mockResolvedValue(err("El nombre ya existe."));

    expect(await updateInventoryProductAction(RECORD_ID, null, formDataOf({ name: "Shampoo" }))).toEqual({
      ok: false,
      error: "El nombre ya existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deleteInventoryProductAction rechaza un identificador inválido", async () => {
    expect(await deleteInventoryProductAction("producto")).toEqual(INVALID);
    expect(deleteInventoryProduct).not.toHaveBeenCalled();
  });

  it("deleteInventoryProductAction devuelve el bloqueo del límite sin borrar", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

    expect(await deleteInventoryProductAction(RECORD_ID)).toEqual(RATE_LIMITED);
    expect(deleteInventoryProduct).not.toHaveBeenCalled();
  });

  it("deleteInventoryProductAction borra en el salón, revalida y confirma", async () => {
    vi.mocked(deleteInventoryProduct).mockResolvedValue(ok(undefined));

    expect(await deleteInventoryProductAction(RECORD_ID)).toEqual(ok("Producto eliminado."));
    expect(deleteInventoryProduct).toHaveBeenCalledWith(RECORD_ID, manager.salon_id);
    expect(revalidatePath).toHaveBeenCalledWith("/inventory");
  });
});
