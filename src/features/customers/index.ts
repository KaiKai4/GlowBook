// Punto publico del modulo customers. Otros modulos importan solo desde aqui.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getActiveCustomerOptions, type CustomerOptionView } from "./use-cases/customer-options";
