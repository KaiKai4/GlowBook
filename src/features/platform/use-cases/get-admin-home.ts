import "server-only";

import { getPlatformAdminHome, type PlatformAdminHomeViewModel } from "./get-platform-admin-home";
import { getPlatformSalonOverviews, type PlatformSalonOverviewsViewModel } from "./get-platform-salon-overviews";

export interface AdminHomeViewModel {
  home: PlatformAdminHomeViewModel;
  salonView: PlatformSalonOverviewsViewModel;
}

// Datos del inicio del admin de plataforma en una sola llamada. Las suscripciones
// (módulo billing) se componen en la página a partir de `salonView.salons`.
export async function getAdminHome(): Promise<AdminHomeViewModel> {
  const [home, salonView] = await Promise.all([getPlatformAdminHome(), getPlatformSalonOverviews()]);
  return { home, salonView };
}
