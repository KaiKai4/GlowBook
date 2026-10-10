// Punto publico del modulo customers. Otros modulos importan solo desde aqui.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getActiveCustomerOptions, type CustomerOptionView } from "./use-cases/customer-options";
export {
  deleteTemporaryCustomer,
  isTemporaryCustomer,
  promoteCustomer,
} from "./use-cases/customer-temporary";

export { checkPermanentCustomerByPhone, findArchivedCustomerByContact, type ArchivedCustomerMatch } from "./use-cases/customer-duplicates";
export { createCustomerProfile, updateCustomerProfile } from "./use-cases/customer-profile";
export { archiveCustomer, reactivateCustomer } from "./use-cases/customer-lifecycle";
export { getCustomersPage } from "./use-cases/get-customers-page";
