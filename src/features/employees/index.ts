// Punto publico del modulo employees. Otros módulos importan solo desde aquí.
// Indice de servidor: los casos de uso consultan la base de datos.
import "server-only";

export { getActiveEmployeeNameOptions } from "./use-cases/employee-name-options";
export { getEmployeeCalendarOptions } from "./use-cases/employee-calendar-options";
export { getEmployeeSchedulingOptions } from "./use-cases/employee-scheduling-options";

export { acceptEmployeeInvitation, getEmployeeInvitationJoinView } from "./use-cases/employee-invitations";
export { changeEmployeeRoleWithGate, generateEmployeeInvite, resetEmployeeAccessWithGate } from "./use-cases/employee-role-commands";
export { archiveEmployee } from "./use-cases/employee-lifecycle";
export { findArchivedEmployeeByEmail, type ArchivedEmployeeMatch, type CreateEmployeeResult, type EmployeeWriteResult } from "./use-cases/employee-profile";
export { createEmployee, updateEmployee } from "./use-cases/employee-profile-commands";
export { reactivateEmployeeWithLimitCheck, addScheduleException } from "./use-cases/employee-lifecycle-commands";
export { addEmployeeWorkSchedule, removeEmployeeWorkSchedule } from "./use-cases/employee-schedule";
export { removeEmployeeScheduleException } from "./use-cases/employee-exceptions";
export { getEmployeesPage } from "./use-cases/get-employees-page";
export { getEmployeeDetail } from "./use-cases/get-employee-detail";

export type { EmployeeAdmissionInput } from "./use-cases/employee-admission";
export type { RoleGate } from "./use-cases/employee-role-commands";
