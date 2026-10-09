// Constructor puro de citas, líneas de cita y recordatorios enviados del benchmark de precios v2.
// Genera doce meses de historial y las citas futuras de la cohorte.
import { randomUUID } from "node:crypto";
import { addMinutes, dateAt } from "../seed-common.mjs";
import { PAYMENT_METHODS } from "../pricing-benchmark-shared.mjs";
import { appointmentStatus, MONTHS_OF_HISTORY, daysInMonthWindow, money, timeSlot } from "./pricing-benchmark-model.mjs";

/**
 * @typedef {ReturnType<typeof import("../pricing-benchmark-shared.mjs").getSelectedCohorts>[number]} CohortConfig
 * @typedef {{ id: string, category_id: string, name: string, duration_minutes: number, price: number }} ServiceLike
 */

/**
 * @typedef {object} AppointmentArgs
 * @property {string} salonId
 * @property {string | null} ownerId
 * @property {CohortConfig} cohort
 * @property {string} cohortKey
 * @property {number} salonNumber
 * @property {number} globalSalonIndex
 * @property {string} batchId
 * @property {ServiceLike[]} services
 * @property {{ id: string }[]} employees
 * @property {{ id: string }[]} customers
 * @property {{ id: string }[]} templates
 */

/**
 * Citas pasadas (historial mensual) con sus líneas y recordatorios enviados.
 * @param {AppointmentArgs} args
 */
function buildHistory(args) {
  const { salonId, ownerId, cohort, cohortKey, salonNumber, globalSalonIndex, batchId, services, employees, customers, templates } = args;
  /** @type {Record<string, unknown>[]} */
  const appointments = [];
  /** @type {Record<string, unknown>[]} */
  const appointmentItems = [];
  /** @type {Record<string, unknown>[]} */
  const reminderLogs = [];
  for (let monthIndex = 0; monthIndex < MONTHS_OF_HISTORY; monthIndex += 1) {
    for (let index = 0; index < cohort.appointmentsPerMonth; index += 1) {
      const { employeeIndex, hour, minute } = timeSlot(index, employees.length);
      const start = dateAt(daysInMonthWindow(monthIndex, index), hour, minute);
      const service = services[(index + monthIndex) % services.length];
      const secondService = index % 4 === 0 ? services[(index + monthIndex + 3) % services.length] : null;
      const status = appointmentStatus(monthIndex, index, false);
      const appointmentId = randomUUID();
      const totalDuration = service.duration_minutes + (secondService?.duration_minutes ?? 0);
      const totalPrice = status === "cancelled" || status === "no_show" ? 0 : money(Number(service.price) + Number(secondService?.price ?? 0));

      appointments.push({
        id: appointmentId,
        salon_id: salonId,
        customer_id: customers[index % customers.length].id,
        start_time: start.toISOString(),
        end_time: addMinutes(start, totalDuration).toISOString(),
        status,
        total_price: totalPrice,
        payment_method: status === "completed" ? PAYMENT_METHODS[index % PAYMENT_METHODS.length] : "",
        discount_amount: status === "completed" && index % 17 === 0 ? 2 : 0,
        completion_price_note: status === "completed" && index % 17 === 0 ? "Ajuste benchmark." : "",
        notes: status === "cancelled" ? "Cancelacion benchmark." : "",
        created_by: ownerId,
        created_at: addMinutes(start, -10_080).toISOString(),
        updated_at: addMinutes(start, totalDuration + 15).toISOString(),
      });
      appointmentItems.push({
        appointment_id: appointmentId,
        salon_id: salonId,
        service_id: service.id,
        employee_id: employees[employeeIndex].id,
        start_time: start.toISOString(),
        end_time: addMinutes(start, service.duration_minutes).toISOString(),
        duration_minutes: service.duration_minutes,
        price: service.price,
        discount_amount: 0,
        ordering: 1,
        blocks_calendar: false,
      });
      if (secondService) {
        const secondStart = addMinutes(start, service.duration_minutes);
        appointmentItems.push({
          appointment_id: appointmentId,
          salon_id: salonId,
          service_id: secondService.id,
          employee_id: employees[(employeeIndex + 1) % employees.length].id,
          start_time: secondStart.toISOString(),
          end_time: addMinutes(secondStart, secondService.duration_minutes).toISOString(),
          duration_minutes: secondService.duration_minutes,
          price: secondService.price,
          discount_amount: 0,
          ordering: 2,
          blocks_calendar: false,
        });
      }
      if (cohort.modules.reminders && status === "completed" && index % 5 === 0) {
        reminderLogs.push({
          salon_id: salonId,
          appointment_id: appointmentId,
          template_id: templates[index % templates.length].id,
          channel: index % 2 === 0 ? "whatsapp" : "email",
          recipient_phone: `64${String(globalSalonIndex).padStart(3, "0")}${String(index + 1).padStart(5, "0")}`,
          recipient_email: `cliente.${batchId}.${cohortKey.toLowerCase()}.${salonNumber}.${(index % customers.length) + 1}@example.com`,
          sent_at: addMinutes(start, -1440).toISOString(),
          created_by: ownerId,
        });
      }
    }
  }
  return { appointments, appointmentItems, reminderLogs };
}

/**
 * Citas futuras (bloquean agenda) distribuidas en los días siguientes.
 * @param {AppointmentArgs} args
 */
function buildFuture(args) {
  const { salonId, ownerId, cohort, services, employees, customers } = args;
  /** @type {Record<string, unknown>[]} */
  const appointments = [];
  /** @type {Record<string, unknown>[]} */
  const appointmentItems = [];
  const futureAppointments = Math.round((cohort.appointmentsPerMonth / 30) * cohort.futureDays);
  for (let index = 0; index < futureAppointments; index += 1) {
    const dayOffset = 1 + Math.floor(index / (employees.length * 24));
    const { employeeIndex, hour, minute } = timeSlot(index, employees.length);
    const start = dateAt(dayOffset, hour, minute);
    const service = services.find((candidate) => candidate.duration_minutes <= 30) ?? services[0];
    const appointmentId = randomUUID();
    const status = appointmentStatus(0, index, true);
    appointments.push({
      id: appointmentId,
      salon_id: salonId,
      customer_id: customers[index % customers.length].id,
      start_time: start.toISOString(),
      end_time: addMinutes(start, service.duration_minutes).toISOString(),
      status,
      total_price: service.price,
      discount_amount: 0,
      payment_method: "",
      completion_price_note: "",
      notes: "",
      created_by: ownerId,
      created_at: addMinutes(start, -4320).toISOString(),
      updated_at: addMinutes(start, -60).toISOString(),
    });
    appointmentItems.push({
      appointment_id: appointmentId,
      salon_id: salonId,
      service_id: service.id,
      employee_id: employees[employeeIndex].id,
      start_time: start.toISOString(),
      end_time: addMinutes(start, service.duration_minutes).toISOString(),
      duration_minutes: service.duration_minutes,
      price: service.price,
      discount_amount: 0,
      ordering: 1,
      blocks_calendar: true,
    });
  }
  return { appointments, appointmentItems };
}

/**
 * Historial y citas futuras de un salón, en el orden en que se insertan.
 * @param {AppointmentArgs} args
 * @returns {{ appointments: Record<string, unknown>[], appointmentItems: Record<string, unknown>[], reminderLogs: Record<string, unknown>[] }}
 */
export function buildAppointmentRows(args) {
  const history = buildHistory(args);
  const future = buildFuture(args);
  return {
    appointments: [...history.appointments, ...future.appointments],
    appointmentItems: [...history.appointmentItems, ...future.appointmentItems],
    reminderLogs: history.reminderLogs,
  };
}
