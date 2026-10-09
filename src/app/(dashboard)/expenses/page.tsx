import { getExpensesPage } from "@/features/expenses/use-cases/expenses";
import { getInventoryProductOptions } from "@/features/inventory/use-cases/inventory-product-options";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireProfile } from "@/infra/auth/session";
import { ReceiptText } from "lucide-react";
import { ExpensesManager } from "./expenses-manager";

export default async function ExpensesPage() {
  const profile = await requireProfile();
  const expensesEnabled = await isEffectiveSalonModuleEnabled(profile, "expenses");

  if (!expensesEnabled || !hasPermission(profile, PERMISSIONS.EXPENSES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar gastos.</p>
      </div>
    );
  }

  const expenses = await getExpensesPage(profile.salon_id);
  const canManageInventory =
    (await isEffectiveSalonModuleEnabled(profile, "inventory")) &&
    hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE);
  const inventoryProducts = canManageInventory ? await getInventoryProductOptions(profile.salon_id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg">
          <ReceiptText className="h-6 w-6 text-brand-500" />
          Gastos
        </h1>
        <p className="mt-0.5 text-sm text-fg-subtle">
          Registra egresos del salon, incluyendo compras de inventario.
        </p>
      </div>
      <ExpensesManager
        expenses={expenses}
        inventoryProducts={inventoryProducts}
        canManageInventory={canManageInventory}
      />
    </div>
  );
}
