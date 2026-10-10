import "server-only";
// Interfaz pública del módulo de plataforma (super-admin). Solo servidor: no importar desde componentes cliente.
// Las rutas de `src/app/(platform)` que aún importan casos de uso directamente quedan pendientes de migrar.
export { getAdminHome } from "./use-cases/get-admin-home";

export { acceptInvitation } from "./use-cases/accept-invitation";
export { deleteSalon } from "./use-cases/delete-salon";
export { inviteSalon, regenerateSalonInvitation } from "./use-cases/invite-salon";
export { updateSalonStatus } from "./use-cases/update-salon-status";
export { getPlatformAuditLog } from "./use-cases/get-platform-audit-log";
export { getPlatformInvitations } from "./use-cases/get-platform-invitations";
export { getPlatformSalonOverviews } from "./use-cases/get-platform-salon-overviews";
export { setFeedbackReportStatus } from "./use-cases/set-feedback-report-status";
export { readFeedbackStatusForm, type FeedbackStatusForm } from "./use-cases/set-feedback-status-form";
export { getPlatformFeedbackReports } from "./use-cases/get-platform-feedback-reports";
