import { getRetailPage } from "@/features/retail/use-cases/retail-sales";
import { isEffectiveSalonModuleEnabled, salonModuleScopeFromProfile } from "@/features/billing";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
import { PageHeader } from "@/components/ui/page-header";
import { ShoppingBag } from "lucide-react";
import { RetailManager } from "./retail-manager";

export default async function RetailPage() {
  const profile = await requireProfile();
  const retailEnabled = await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "retail");

  if (!retailEnabled || !hasPermission(profile, PERMISSIONS.RETAIL_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar vitrina.</p>
      </div>
    );
  }

  const retail = await getRetailPage(profile.salon_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-brand-500" aria-hidden="true" />
            Vitrina
          </span>
        }
        description="Registra ventas de productos y descuenta inventario automaticamente."
      />
      <RetailManager retail={retail} />
    </div>
  );
}
