import "server-only";
// Punto publico del modulo feedback. Otros modulos importan solo desde aqui.
// Solo exporta el catalogo de categorias (puro, sin I/O).
export { FEEDBACK_CATEGORY_LABELS } from "./schemas";
export type { FeedbackCategory } from "./schemas";

export { submitFeedback } from "./use-cases/submit-feedback";
