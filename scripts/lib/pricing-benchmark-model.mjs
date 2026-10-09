// Modelo puro del benchmark de precios v2: meses de historia, reparto determinista de citas,
// nombres y estimación de filas por cohorte. No hace E/S.
import { FIRST_NAMES, LAST_NAMES } from "../seed-pricing-benchmark-catalog.mjs";

/** @typedef {ReturnType<typeof import("../pricing-benchmark-shared.mjs").getSelectedCohorts>[number]} CohortConfig */

/** Meses de historia que genera el benchmark por salón. */
export const MONTHS_OF_HISTORY = 12;

/** @param {number} value */
export function money(value) {
  return Number(value.toFixed(2));
}

/**
 * Nombre determinista a partir del índice (y de una sal opcional).
 * @param {number} index
 * @param {number} [salt]
 * @returns {{ firstName: string, lastName: string }}
 */
export function nameAt(index, salt = 0) {
  return {
    firstName: FIRST_NAMES[(index + salt) % FIRST_NAMES.length],
    lastName: LAST_NAMES[(index * 3 + salt) % LAST_NAMES.length],
  };
}

/**
 * Estado de la cita: las futuras son confirmadas o agendadas; las pasadas se reparten en completadas,
 * canceladas y no-show.
 * @param {number} monthIndex
 * @param {number} appointmentIndex
 * @param {boolean} isFuture
 * @returns {string}
 */
export function appointmentStatus(monthIndex, appointmentIndex, isFuture) {
  if (isFuture) return appointmentIndex % 3 === 0 ? "confirmed" : "scheduled";
  const mod = (monthIndex * 7 + appointmentIndex) % 20;
  if (mod < 13) return "completed";
  if (mod < 17) return "cancelled";
  if (mod < 19) return "no_show";
  return "completed";
}

/**
 * Desplazamiento en días (relativo a hoy) de una cita del historial.
 * @param {number} monthIndex
 * @param {number} appointmentIndex
 * @returns {number}
 */
export function daysInMonthWindow(monthIndex, appointmentIndex) {
  const monthStart = -30 * (MONTHS_OF_HISTORY - monthIndex);
  return monthStart + (appointmentIndex % 28);
}

/**
 * Reparto de la cita entre empleadas y franja horaria (08:00 a 19:30 en bloques de 30 minutos).
 * @param {number} appointmentIndex
 * @param {number} employeesCount
 * @returns {{ employeeIndex: number, hour: number, minute: number }}
 */
export function timeSlot(appointmentIndex, employeesCount) {
  const employeeIndex = appointmentIndex % employeesCount;
  const dailySlot = Math.floor(appointmentIndex / employeesCount) % 24;
  const hour = 8 + Math.floor(dailySlot / 2);
  const minute = dailySlot % 2 === 0 ? 0 : 30;
  return { employeeIndex, hour, minute };
}

/**
 * Estima filas por tabla y por cohorte para el modo de simulación (dry-run).
 * @param {CohortConfig[]} cohorts
 */
export function estimateRows(cohorts) {
  /** @type {{ cohort: string, salons: number, perSalon: Record<string, number>, cohortTotals: Record<string, number> }[]} */
  const estimates = [];
  for (const cohort of cohorts) {
    const appointmentsPerSalon =
      cohort.appointmentsPerMonth * MONTHS_OF_HISTORY +
      Math.round((cohort.appointmentsPerMonth / 30) * cohort.futureDays);
    const perSalon = {
      salons: 1,
      authUsers: 1 + cohort.collaborators,
      customers: cohort.customers,
      collaborators: cohort.collaborators,
      services: cohort.categories * cohort.servicesPerCategory,
      appointments: appointmentsPerSalon,
      appointment_items: Math.round(appointmentsPerSalon * 1.25),
      retail_sales: cohort.modules.retail ? (cohort.retailSalesPerMonth ?? 0) * MONTHS_OF_HISTORY : 0,
      expenses: cohort.modules.expenses ? (cohort.expensesPerMonth ?? 0) * MONTHS_OF_HISTORY : 0,
      inventory_products: cohort.modules.inventory || cohort.modules.retail ? cohort.products ?? 0 : 0,
      inventory_movements: cohort.modules.inventory ? (cohort.movementsPerMonth ?? 0) * MONTHS_OF_HISTORY : 0,
    };
    estimates.push({
      cohort: cohort.key,
      salons: cohort.salons,
      perSalon,
      cohortTotals: Object.fromEntries(
        Object.entries(perSalon).map(([key, value]) => [key, value * cohort.salons])
      ),
    });
  }
  return estimates;
}
