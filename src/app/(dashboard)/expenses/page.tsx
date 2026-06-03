import { getExpensesPage } from "@/features/expenses/use-cases/expenses";
import { getInventoryPage } from "@/features/inventory/use-cases/inventory-products";
import { hasPermission, hasSalonFeature, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { ReceiptText } from "lucide-react";
import { ExpensesManager } from "./expenses-manager";

export default async function ExpensesPage() {
  const profile = await requireProfile();

  if (!hasSalonFeature(profile, "expenses") || !hasPermission(profile, PERMISSIONS.EXPENSES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para gestionar gastos.</p>
      </div>
    );
  }

  const expenses = await getExpensesPage(profile.salon_id);
  const canManageInventory =
    hasSalonFeature(profile, "inventory") && hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE);
  const inventory = canManageInventory ? await getInventoryPage(profile.salon_id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <ReceiptText className="h-6 w-6 text-brand-500" />
          Gastos
        </h1>
        <p className="mt-0.5 text-sm text-stone-400">
          Registra egresos del salon, incluyendo compras de inventario.
        </p>
      </div>
      <ExpensesManager
        expenses={expenses}
        inventoryProducts={inventory?.products ?? []}
        canManageInventory={canManageInventory}
      />
    </div>
  );
}
