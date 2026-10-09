import { requireProfile } from "@/infra/auth/session";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { getSalonSettings } from "@/features/salon/use-cases/get-salon-settings";
import { SalonSettings } from "./salon-settings";

export default async function SalonSettingsPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para configurar el salon.</p>
      </div>
    );
  }

  const settings = await getSalonSettings(profile.salon_id);

  return (
    <SalonSettings
      salonName={settings.salonName}
      timezone={settings.timezone}
      theme={settings.theme}
      bgStyle={settings.bgStyle}
      paymentMethods={settings.paymentMethods}
      businessHours={settings.businessHours}
    />
  );
}
