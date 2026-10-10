import "server-only";
// Punto publico del modulo feedback. Otros módulos importan solo desde aquí.
// Solo exporta el catálogo de categorias (puro, sin I/O).
export { FEEDBACK_CATEGORY_LABELS } from "./schemas";
export type { FeedbackCategory } from "./schemas";

export { submitFeedback } from "./use-cases/submit-feedback";
