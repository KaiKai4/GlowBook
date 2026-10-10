import { requireProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { getSalonSettings } from "@/features/salon";
import { SalonSettings } from "./salon-settings";

export default async function SalonSettingsPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para configurar el salón.</p>
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
