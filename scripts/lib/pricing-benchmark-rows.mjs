// Constructores puros de filas del benchmark de precios v2 para salón, roles, catálogo, personal y
// clientas. No hace E/S: los ids de Auth y de filas insertadas llegan como parámetros.
import { employeeEmailFor, PAYMENT_METHODS } from "../pricing-benchmark-shared.mjs";
import { SERVICE_CATALOG } from "../seed-pricing-benchmark-catalog.mjs";
import { dateAt, dateOnly } from "../seed-common.mjs";
import { money, nameAt } from "./pricing-benchmark-model.mjs";

/**
 * @typedef {ReturnType<typeof import("../pricing-benchmark-shared.mjs").getSelectedCohorts>[number]} CohortConfig
 * @typedef {{ index: number, firstName: string, lastName: string, fullName: string, email: string }} StaffPlan
 */

/**
 * Fila del salón: nombre, colores y funciones desactivadas según el módulo de la cohorte.
 * @param {{ cohort: CohortConfig, cohortKey: string, salonNumber: number, globalSalonIndex: number, ownerEmail: string }} args
 */
export function buildSalonRow({ cohort, cohortKey, salonNumber, globalSalonIndex, ownerEmail }) {
  const disabledFeatures = [
    !cohort.modules.retail ? "retail" : null,
    !cohort.modules.inventory ? "inventory" : null,
    !cohort.modules.expenses ? "expenses" : null,
  ].filter(Boolean);

  return {
    name: `Benchmark ${cohortKey} - ${cohort.label} ${salonNumber}`,
    email: ownerEmail,
    phone: `60${String(globalSalonIndex).padStart(6, "0")}`,
    address: `Benchmark local ${globalSalonIndex}, Panama`,
    timezone: "America/Panama",
    theme: cohortKey === "E" ? "indigo" : "violet",
    primary_color: cohortKey === "C" ? "#2563EB" : "#7C3AED",
    secondary_color: "#A78BFA",
    disabled_features: disabledFeatures,
    payment_methods: PAYMENT_METHODS,
    min_booking_notice_minutes: 0,
    min_appointment_duration_minutes: 15,
    allow_off_hours_bookings: false,
    is_active: true,
  };
}

/** @param {string} salonId */
export function buildRoleRows(salonId) {
  return [
    { salon_id: salonId, name: "Owner", is_system: true },
    { salon_id: salonId, name: "Colaborador", is_system: true },
  ];
}

/**
 * El Owner recibe todos los permisos; el Colaborador solo "appointments.view".
 * @param {{ salonId: string, ownerRoleId: string, collaboratorRoleId: string, permissionIds: { id: string, key: string }[] }} args
 */
export function buildRolePermissionRows({ salonId, ownerRoleId, collaboratorRoleId, permissionIds }) {
  return [
    ...permissionIds.map((permission) => ({
      salon_id: salonId,
      role_id: ownerRoleId,
      permission_id: permission.id,
    })),
    ...permissionIds
      .filter((permission) => permission.key === "appointments.view")
      .map((permission) => ({
        salon_id: salonId,
        role_id: collaboratorRoleId,
        permission_id: permission.id,
      })),
  ];
}

/** Horario fijo: lunes a sábado de 08:00 a 20:00; domingo cerrado. @param {string} salonId */
export function buildBusinessHourRows(salonId) {
  return Array.from({ length: 7 }, (_, day) => ({
    salon_id: salonId,
    day_of_week: day,
    is_open: day !== 0,
    open_time: day === 0 ? null : "08:00",
    close_time: day === 0 ? null : "20:00",
  }));
}

/** Plantillas de recordatorio por WhatsApp y por correo. @param {string} salonId */
export function buildTemplateRows(salonId) {
  return [
    {
      salon_id: salonId,
      channel: "whatsapp",
      event: "appointment_reminder",
      recipient: "customer",
      name: "Recordatorio 24 horas",
      subject: "",
      body_text: "Hola, te recordamos tu cita en GlowBook.",
      body_html: "",
      is_active: true,
    },
    {
      salon_id: salonId,
      channel: "email",
      event: "appointment_reminder",
      recipient: "customer",
      name: "Recordatorio por correo",
      subject: "Recordatorio de cita",
      body_text: "Te esperamos en tu cita.",
      body_html: "",
      is_active: true,
    },
  ];
}

/**
 * Categorías de la cohorte (primeras N del catálogo).
 * @param {string} salonId
 * @param {CohortConfig} cohort
 */
export function buildCategoryRows(salonId, cohort) {
  return SERVICE_CATALOG.slice(0, cohort.categories).map(([name, pricing_mode], index) => ({
    salon_id: salonId,
    name,
    pricing_mode,
    ordering: index + 1,
    is_active: true,
    description: `Categoria ${name} para benchmark.`,
  }));
}

/**
 * Servicios de la cohorte. El precio se desplaza por la letra de la cohorte (A=0, B=1, ...).
 * @param {string} salonId
 * @param {CohortConfig} cohort
 * @param {{ id: string }[]} categories filas de service_categories insertadas, en orden de catálogo
 */
export function buildServiceRows(salonId, cohort, categories) {
  return SERVICE_CATALOG.slice(0, cohort.categories).flatMap((category, categoryIndex) =>
    category[2].slice(0, cohort.servicesPerCategory).map(([name, duration, price]) => ({
      salon_id: salonId,
      category_id: categories[categoryIndex].id,
      name,
      duration_minutes: duration,
      price: money(price + cohort.key.charCodeAt(0) - 64),
      description: `${name} para benchmark de pricing.`,
      is_active: true,
    }))
  );
}

/**
 * Plan de personal (colaboradoras) de un salón: nombres y correos deterministas.
 * @param {CohortConfig} cohort
 * @param {{ batchId: string, cohortKey: string, salonNumber: number, globalSalonIndex: number }} args
 * @returns {StaffPlan[]}
 */
export function buildStaffPlan(cohort, { batchId, cohortKey, salonNumber, globalSalonIndex }) {
  /** @type {StaffPlan[]} */
  const plan = [];
  for (let index = 1; index <= cohort.collaborators; index += 1) {
    const { firstName, lastName } = nameAt(index, globalSalonIndex);
    plan.push({
      index,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: employeeEmailFor(batchId, cohortKey, salonNumber, index),
    });
  }
  return plan;
}

/**
 * Filas de empleadas. `profileIds[i]` es el id de Auth de `staff[i]` (o null en modo sintético).
 * @param {{ salonId: string, categories: { name: string }[], globalSalonIndex: number, staff: StaffPlan[], profileIds: (string | null)[] }} args
 */
export function buildEmployeeRows({ salonId, categories, globalSalonIndex, staff, profileIds }) {
  return staff.map((person, position) => ({
    salon_id: salonId,
    first_name: person.firstName,
    last_name: person.lastName,
    specialty: categories[(person.index - 1) % categories.length].name,
    email: person.email,
    phone: `62${String(globalSalonIndex).padStart(3, "0")}${String(person.index).padStart(4, "0")}`,
    profile_id: profileIds[position],
    commission_percentage: 35 + (person.index % 3) * 5,
    is_active: true,
    hire_date: dateOnly(dateAt(-260 - person.index, 12)),
  }));
}

/**
 * Perfiles de colaboradoras con rol Colaborador.
 * @param {{ salonId: string, collaboratorRoleId: string, staff: StaffPlan[], profileIds: (string | null)[] }} args
 */
export function buildCollaboratorProfileRows({ salonId, collaboratorRoleId, staff, profileIds }) {
  return staff.map((person, position) => ({
    id: profileIds[position],
    salon_id: salonId,
    full_name: person.fullName,
    role_id: collaboratorRoleId,
    is_owner: false,
    is_active: true,
  }));
}

/**
 * Clientas del salón (una de cada veinte es "frecuente"; una de cada cuarenta y uno está inactiva).
 * @param {{ salonId: string, cohort: CohortConfig, cohortKey: string, batchId: string, salonNumber: number, globalSalonIndex: number }} args
 */
export function buildCustomerRows({ salonId, cohort, cohortKey, batchId, salonNumber, globalSalonIndex }) {
  return Array.from({ length: cohort.customers }, (_, index) => {
    const { firstName, lastName } = nameAt(index, globalSalonIndex);
    return {
      salon_id: salonId,
      first_name: firstName,
      last_name: `${lastName} ${index + 1}`,
      phone: `64${String(globalSalonIndex).padStart(3, "0")}${String(index + 1).padStart(5, "0")}`,
      email: `cliente.${batchId}.${cohortKey.toLowerCase()}.${salonNumber}.${index + 1}@example.com`,
      notes: index % 20 === 0 ? "Cliente frecuente benchmark." : "",
      is_active: index % 41 !== 0,
      is_temporary: false,
    };
  });
}

/**
 * Filas de empleadas enlazadas con servicios y categorías, y horario de lunes a sábado.
 * @param {{ salonId: string, employees: { id: string }[], services: { id: string }[], categories: { id: string }[] }} args
 */
export function buildEmployeeLinkRows({ salonId, employees, services, categories }) {
  return {
    employeeServices: employees.flatMap((employee) =>
      services.map((service) => ({ salon_id: salonId, employee_id: employee.id, service_id: service.id }))
    ),
    employeeCategories: employees.flatMap((employee) =>
      categories.map((category) => ({ salon_id: salonId, employee_id: employee.id, category_id: category.id }))
    ),
    workSchedules: employees.flatMap((employee) =>
      Array.from({ length: 6 }, (_, index) => ({
        salon_id: salonId,
        employee_id: employee.id,
        day_of_week: index + 1,
        start_time: "08:00",
        end_time: "20:00",
        is_active: true,
      }))
    ),
  };
}
