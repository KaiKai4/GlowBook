// Punto publico del modulo appointments. Otros modulos importan solo desde aqui.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getAppointmentReminderTarget } from "./use-cases/appointment-reminder-target";
export { isClosedStatus } from "./domain/lifecycle";
export {
  getRemindableAppointments,
  type RemindableAppointment,
} from "./use-cases/remindable-appointments";
