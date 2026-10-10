// Punto publico del modulo appointments. Otros modulos y src/app importan solo desde aqui.
// Indice de servidor ("server-only"): los casos de uso consultan la base de datos.
// Excepcion documentada: los componentes cliente importan dominio puro (sin server-only)
// directamente de domain/ (lifecycle, summary-filter, pricing, wizard-availability, types)
// y tipos de view-models; este indice no debe importarse desde un componente cliente.
import "server-only";

export { getAppointmentReminderTarget } from "./use-cases/appointment-reminder-target";
export { isClosedStatus } from "./domain/lifecycle";
export {
  getRemindableAppointments,
  type RemindableAppointment,
} from "./use-cases/remindable-appointments";
export {
  getOccupiedSlotsForSalonDate,
  type OccupiedByEmployee,
} from "./use-cases/appointment-availability";
export { cancelAppointment } from "./use-cases/cancel-appointment";
export { getCalendarView } from "./use-cases/get-calendar-view";
export { getAppointmentWizardData } from "./use-cases/get-appointment-wizard-data";
export {
  getAppointmentDetail,
} from "./use-cases/get-appointment-detail";
export { confirmAppointment } from "./use-cases/confirm-appointment";
export { completeAppointment } from "./use-cases/complete-appointment";
export type { CompleteAppointmentRpcResult as CompleteAppointmentResult } from "./data/rpc/complete-appointment";
export { createAppointmentGuarded } from "./use-cases/create-appointment-checks";
export { updateAppointmentSchedule } from "./use-cases/update-appointment";
export {
  parseCompleteAppointmentForm,
  parseCreateAppointmentForm,
  parseUpdateAppointmentScheduleForm,
} from "./use-cases/parse-appointment-input";
export {
  AppointmentLifecycleSchema,
  CancelAppointmentSchema,
  type CompleteAppointmentInput,
  type CreateAppointmentInput,
  type UpdateAppointmentScheduleInput,
} from "./schemas";

