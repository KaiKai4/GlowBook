import { getInventoryPage } from "@/features/inventory/use-cases/inventory-products";
import { isEffectiveSalonModuleEnabled, salonModuleScopeFromProfile } from "@/features/billing";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
import { PageHeader } from "@/components/ui/page-header";
import { Package } from "lucide-react";
import { InventoryManager } from "./inventory-manager";

export default async function InventoryPage() {
  const profile = await requireProfile();
  const inventoryEnabled = await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "inventory");

  if (!inventoryEnabled || !hasPermission(profile, PERMISSIONS.INVENTORY_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar inventario.</p>
      </div>
    );
  }

  const inventory = await getInventoryPage(profile.salon_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Package className="h-6 w-6 text-brand-500" />
            Inventario
          </span>
        }
        description="Controla vitrina, uso interno y bodega por producto."
      />
      <InventoryManager inventory={inventory} />
    </div>
  );
}
