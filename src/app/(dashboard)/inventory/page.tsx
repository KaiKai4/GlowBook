import { getInventoryPage } from "@/features/inventory/use-cases/inventory-products";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { Package } from "lucide-react";
import { InventoryManager } from "./inventory-manager";

export default async function InventoryPage() {
  const profile = await requireProfile();
  const inventoryEnabled = await isEffectiveSalonModuleEnabled(profile, "inventory");

  if (!inventoryEnabled || !hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para gestionar inventario.</p>
      </div>
    );
  }

  const inventory = await getInventoryPage(profile.salon_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <Package className="h-6 w-6 text-brand-500" />
          Inventario
        </h1>
        <p className="mt-0.5 text-sm text-stone-400">
          Controla vitrina, uso interno y bodega por producto.
        </p>
      </div>
      <InventoryManager inventory={inventory} />
    </div>
  );
}
