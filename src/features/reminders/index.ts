// Interfaz pública del módulo de recordatorios. La app importa desde aquí;
// los componentes cliente que necesitan solo dominio puro importan de `domain/`.
export { getReminderQueue } from "./use-cases/get-reminder-queue";
export { recordManualReminder } from "./use-cases/record-manual-reminder";
export {
  parseConfirmReminderInput,
  parseManualReminderInput,
  type ConfirmReminderFields,
  type ManualReminderFields,
  type ManualReminderInput,
} from "./use-cases/reminder-input";
export type { ReminderAppointment, ReminderEmployee } from "./view-models";
