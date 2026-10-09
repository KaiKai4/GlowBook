import "server-only";
import { cache } from "react";
import {
  getDashboardShell,
  type DashboardShellViewModel,
} from "@/features/salon/use-cases/get-dashboard-shell";
import type { ProfileWithRole } from "@/types/app.types";

// Lectores memoizados por request del composition root. React cache vive solo
// aqui: infra y casos de uso no dependen de react. Layout y pagina piden el
// shell con el mismo perfil (el de request-context, cacheado por request), asi
// que el plan efectivo se lee una sola vez por request.

/**
 * Shell del dashboard (plan efectivo, permisos, estado de pago) de la request
 * actual. Memoizado por identidad del perfil de la request.
 */
export const getCachedDashboardShell = cache(
  (profile: ProfileWithRole): Promise<DashboardShellViewModel | null> => getDashboardShell(profile),
);
