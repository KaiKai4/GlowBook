// Punto publico del modulo notifications. Otros modulos importan solo desde aqui.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getActiveMessageTemplate } from "./use-cases/active-message-template";
