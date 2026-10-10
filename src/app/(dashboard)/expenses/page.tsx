import { getExpensesPage } from "@/features/expenses";
import { getInventoryProductOptions } from "@/features/inventory";
import { isEffectiveSalonModuleEnabled, salonModuleScopeFromProfile } from "@/features/billing";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
import { PageHeader } from "@/components/ui/page-header";
import { ReceiptText } from "lucide-react";
import { ExpensesManager } from "./expenses-manager";

export default async function ExpensesPage() {
  const profile = await requireProfile();
  const expensesEnabled = await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "expenses");

  if (!expensesEnabled || !hasPermission(profile, PERMISSIONS.EXPENSES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar gastos.</p>
      </div>
    );
  }

  const expenses = await getExpensesPage(profile.salon_id);
  const canManageInventory =
    (await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "inventory")) &&
    hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE);
  const inventoryProducts = canManageInventory ? await getInventoryProductOptions(profile.salon_id) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ReceiptText className="h-6 w-6 text-brand-500" />
            Gastos
          </span>
        }
        description="Registra egresos del salon, incluyendo compras de inventario."
      />
      <ExpensesManager
        expenses={expenses}
        inventoryProducts={inventoryProducts}
        canManageInventory={canManageInventory}
      />
    </div>
  );
}
