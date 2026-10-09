// Constructores puros de filas del estudio de precios (sin E/S). Cada función devuelve las filas
// que el script inserta en una tabla; los ids de filas ya insertadas llegan como parámetros.
import { dateAt, dateOnly, emailFor } from "../seed-common.mjs";
import { CATEGORY_BLUEPRINTS, EMPLOYEE_NAMES, FIRST_NAMES, LAST_NAMES } from "./pricing-study-catalog.mjs";

/**
 * @typedef {import("../types/seeds.d.cts").ServiceRow} ServiceRow
 */

/** @param {number} value */
export function roundMoney(value) {
  return Number(value.toFixed(2));
}

/**
 * Nombre determinista de clienta a partir del índice y del salón.
 * @param {number} index
 * @param {number} salonIndex
 * @returns {{ firstName: string, lastName: string }}
 */
function customerName(index, salonIndex) {
  const firstName = FIRST_NAMES[(index + salonIndex) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index * 3 + salonIndex) % LAST_NAMES.length];
  return { firstName, lastName };
}

/** @param {string} salonId */
export function buildBusinessHourRows(salonId) {
  return Array.from({ length: 7 }, (_, day) => ({
    salon_id: salonId,
    day_of_week: day,
    is_open: day !== 0,
    open_time: day === 0 ? null : "08:00",
    close_time: day === 0 ? null : day <= 2 ? "21:00" : "18:00",
  }));
}

/** @param {string} salonId */
export function buildCategoryRows(salonId) {
  return CATEGORY_BLUEPRINTS.map((category, index) => ({
    salon_id: salonId,
    name: category.name,
    pricing_mode: category.pricing_mode,
    ordering: index + 1,
    is_active: true,
    description: `Servicios de ${category.name.toLowerCase()} para estudio de precios.`,
  }));
}

/**
 * @param {string} salonId
 * @param {{ id: string }[]} categories filas de service_categories insertadas, en el orden del catálogo
 * @param {number} salonIndex
 */
export function buildServiceRows(salonId, categories, salonIndex) {
  return CATEGORY_BLUEPRINTS.flatMap((category, categoryIndex) =>
    category.services.map(([name, duration, price]) => ({
      salon_id: salonId,
      category_id: categories[categoryIndex].id,
      name,
      duration_minutes: duration,
      price: roundMoney(price + salonIndex),
      description: `${name} generado para medir uso por plan.`,
      is_active: true,
    }))
  );
}

/**
 * @param {string} salonId
 * @param {string} batchId
 * @param {number} salonIndex
 */
export function buildEmployeeRows(salonId, batchId, salonIndex) {
  return EMPLOYEE_NAMES.map(([firstName, lastName, specialty], index) => ({
    salon_id: salonId,
    first_name: firstName,
    last_name: lastName,
    specialty,
    email: emailFor(batchId, "employee", salonIndex, index + 1),
    phone: `62${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
    commission_percentage: index % 2 === 0 ? 35 : 40,
    is_active: true,
    hire_date: dateOnly(dateAt(-220 - index * 7, 12)),
  }));
}

/**
 * @param {string} salonId
 * @param {{ id: string }[]} employees
 * @param {ServiceRow[]} services
 */
export function buildEmployeeServiceRows(salonId, employees, services) {
  return employees.flatMap((employee) =>
    services.map((service) => ({
      salon_id: salonId,
      employee_id: employee.id,
      service_id: service.id,
    }))
  );
}

/**
 * @param {string} salonId
 * @param {{ id: string }[]} employees
 * @param {{ id: string }[]} categories
 */
export function buildEmployeeCategoryRows(salonId, employees, categories) {
  return employees.flatMap((employee) =>
    categories.map((category) => ({
      salon_id: salonId,
      employee_id: employee.id,
      category_id: category.id,
    }))
  );
}

/**
 * Seis días laborales por empleada (lunes a sábado).
 * @param {string} salonId
 * @param {{ id: string }[]} employees
 */
export function buildWorkScheduleRows(salonId, employees) {
  return employees.flatMap((employee) =>
    Array.from({ length: 6 }, (_, day) => ({
      salon_id: salonId,
      employee_id: employee.id,
      day_of_week: day + 1,
      start_time: "08:00",
      end_time: day <= 1 ? "21:00" : "18:00",
      is_active: true,
    }))
  );
}

/**
 * 90 clientas por salón; cada quinta tiene fecha de nacimiento y cada 29 está inactiva.
 * @param {string} salonId
 * @param {string} batchId
 * @param {number} salonIndex
 */
export function buildCustomerRows(salonId, batchId, salonIndex) {
  return Array.from({ length: 90 }, (_, index) => {
    const { firstName, lastName } = customerName(index, salonIndex);
    return {
      salon_id: salonId,
      first_name: firstName,
      last_name: lastName,
      phone: `64${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
      email: `cliente.${batchId}.${salonIndex}.${index + 1}@example.com`,
      notes: index % 9 === 0 ? "Cliente frecuente con preferencia de tarde." : "",
      is_active: index % 29 !== 0,
      is_temporary: false,
      birth_date: index % 5 === 0 ? `199${index % 10}-0${(index % 9) + 1}-15` : null,
    };
  });
}
