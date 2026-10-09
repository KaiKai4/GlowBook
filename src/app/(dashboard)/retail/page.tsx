import { getRetailPage } from "@/features/retail/use-cases/retail-sales";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireProfile } from "@/infra/auth/session";
import { ShoppingBag } from "lucide-react";
import { RetailManager } from "./retail-manager";

export default async function RetailPage() {
  const profile = await requireProfile();
  const retailEnabled = await isEffectiveSalonModuleEnabled(profile, "retail");

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
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg">
          <ShoppingBag className="h-6 w-6 text-brand-500" />
          Vitrina
        </h1>
        <p className="mt-0.5 text-sm text-fg-subtle">
          Registra ventas de productos y descuenta inventario automaticamente.
        </p>
      </div>
      <RetailManager retail={retail} />
    </div>
  );
}
