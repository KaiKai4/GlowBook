// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getExpensesPage, type ExpensesPageView } from "@/features/expenses/use-cases/expenses";
import { getInventoryProductOptions } from "@/features/inventory/use-cases/inventory-product-options";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { hasPermission, PERMISSIONS, type Permission } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import ExpensesPage from "./page";
import { ExpensesManager } from "./expenses-manager";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

vi.mock("@/features/expenses/use-cases/expenses", () => ({
  getExpensesPage: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-product-options", () => ({
  getInventoryProductOptions: vi.fn(),
}));

const VIEW: ExpensesPageView = {
  history: [],
  monthTotal: 0,
  lifetimeTotal: 0,
  categoryTotals: [],
  topCategory: null,
};

interface Setup {
  expensesModule?: boolean;
  inventoryModule?: boolean;
  granted?: Permission[];
}

function configure({ expensesModule = true, inventoryModule = true, granted = [] }: Setup) {
  vi.mocked(isEffectiveSalonModuleEnabled).mockImplementation(async (_scope, moduleKey) =>
    moduleKey === "expenses" ? expensesModule : inventoryModule
  );
  vi.mocked(hasPermission).mockImplementation((_profile, permission) => granted.includes(permission));
}

describe("ExpensesPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(isEffectiveSalonModuleEnabled).mockReset();
    vi.mocked(getExpensesPage).mockReset();
    vi.mocked(getInventoryProductOptions).mockReset();
    vi.mocked(getExpensesPage).mockResolvedValue(VIEW);
    vi.mocked(getInventoryProductOptions).mockResolvedValue([{ id: "prod-1", name: "Shampoo" }]);
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el acceso sin cargar datos cuando el módulo de gastos está desactivado", async () => {
    configure({ expensesModule: false, granted: [PERMISSIONS.EXPENSES_MANAGE] });

    mounted = mountComponent(await ExpensesPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar gastos.");
    expect(getExpensesPage).not.toHaveBeenCalled();
    expect(getInventoryProductOptions).not.toHaveBeenCalled();
  });

  it("niega el acceso cuando falta el permiso de gastos aunque el módulo esté activo", async () => {
    configure({ granted: [PERMISSIONS.INVENTORY_MANAGE] });

    mounted = mountComponent(await ExpensesPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar gastos.");
    expect(getExpensesPage).not.toHaveBeenCalled();
  });

  it("carga las opciones de inventario cuando el módulo y el permiso de inventario están activos", async () => {
    configure({ granted: [PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE] });

    const element = await ExpensesPage();

    expect(getExpensesPage).toHaveBeenCalledWith("salon-1");
    expect(getInventoryProductOptions).toHaveBeenCalledWith("salon-1");
    expect(element.props.children[1].type).toBe(ExpensesManager);
    expect(element.props.children[1].props).toMatchObject({
      expenses: VIEW,
      inventoryProducts: [{ id: "prod-1", name: "Shampoo" }],
      canManageInventory: true,
    });
  });

  it("no carga inventario cuando el módulo de inventario está desactivado", async () => {
    configure({ inventoryModule: false, granted: [PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE] });

    const element = await ExpensesPage();

    expect(getInventoryProductOptions).not.toHaveBeenCalled();
    expect(element.props.children[1].type).toBe(ExpensesManager);
    expect(element.props.children[1].props).toMatchObject({
      inventoryProducts: [],
      canManageInventory: false,
    });
  });

  it("no carga inventario cuando falta el permiso de inventario", async () => {
    configure({ granted: [PERMISSIONS.EXPENSES_MANAGE] });

    const element = await ExpensesPage();

    expect(getInventoryProductOptions).not.toHaveBeenCalled();
    expect(element.props.children[1].props).toMatchObject({
      inventoryProducts: [],
      canManageInventory: false,
    });
  });
});
