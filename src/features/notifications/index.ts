// Punto publico del modulo notifications. Otros módulos importan solo desde aquí.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getActiveMessageTemplate } from "./use-cases/active-message-template";

export { updateMessageTemplate } from "./use-cases/update-message-template";
export { parseNotificationTemplateInput } from "./use-cases/template-input";
export type { NotificationTemplateInput } from "./schemas";
export { getTemplateSettings } from "./use-cases/get-template-settings";
