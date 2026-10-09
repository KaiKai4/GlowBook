// Pruebas del modelo puro del benchmark de precios v2 (node:test, sin red ni base de datos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_NAMES, LAST_NAMES } from "../seed-pricing-benchmark-catalog.mjs";
import { appointmentStatus, daysInMonthWindow, estimateRows, money, MONTHS_OF_HISTORY, nameAt, timeSlot } from "./pricing-benchmark-model.mjs";

/** @typedef {import("./pricing-benchmark-model.mjs").CohortConfig} CohortConfig */

/**
 * Cohorte mínima para estimar filas; los campos no indicados toman valores neutros.
 * @param {Record<string, unknown>} fields
 * @returns {CohortConfig}
 */
function cohortOf(fields) {
  const base = {
    key: "A",
    label: "Cohorte A",
    salons: 2,
    collaborators: 2,
    categories: 3,
    servicesPerCategory: 2,
    customers: 10,
    appointmentsPerMonth: 30,
    futureDays: 30,
    products: 6,
    purchasesPerMonth: 0,
    retailSalesPerMonth: 5,
    expensesPerMonth: 4,
    movementsPerMonth: 0,
    modules: { retail: true, inventory: false, expenses: true, reminders: false },
    ...fields,
  };
  return /** @type {CohortConfig} */ (/** @type {unknown} */ (base));
}

test("money redondea a dos decimales", () => {
  assert.equal(money(1.234), 1.23);
  assert.equal(money(10), 10);
});

test("nameAt es determinista y usa las listas del catálogo con desplazamiento", () => {
  assert.deepEqual(nameAt(0), { firstName: FIRST_NAMES[0], lastName: LAST_NAMES[0] });
  assert.deepEqual(nameAt(1, 2), {
    firstName: FIRST_NAMES[3 % FIRST_NAMES.length],
    lastName: LAST_NAMES[(1 * 3 + 2) % LAST_NAMES.length],
  });
  assert.deepEqual(nameAt(4), nameAt(4));
});

test("las citas futuras son confirmadas o agendadas según el índice", () => {
  assert.equal(appointmentStatus(0, 0, true), "confirmed");
  assert.equal(appointmentStatus(0, 1, true), "scheduled");
  assert.equal(appointmentStatus(5, 3, true), "confirmed");
});

test("las citas pasadas se reparten en completadas, canceladas y no-show", () => {
  assert.equal(appointmentStatus(0, 0, false), "completed");
  assert.equal(appointmentStatus(0, 13, false), "cancelled");
  assert.equal(appointmentStatus(0, 17, false), "no_show");
  assert.equal(appointmentStatus(0, 19, false), "completed");
});

test("la ventana del historial abarca desde el primer mes hasta el día 27 del último", () => {
  assert.equal(daysInMonthWindow(MONTHS_OF_HISTORY - 1, 0), -30);
  assert.equal(daysInMonthWindow(0, 27), -30 * MONTHS_OF_HISTORY + 27);
  assert.equal(daysInMonthWindow(0, 28), -30 * MONTHS_OF_HISTORY);
});

test("timeSlot reparte por empleada y avanza cada 30 minutos", () => {
  assert.deepEqual(timeSlot(0, 3), { employeeIndex: 0, hour: 8, minute: 0 });
  assert.deepEqual(timeSlot(1, 3), { employeeIndex: 1, hour: 8, minute: 0 });
  assert.deepEqual(timeSlot(3, 3), { employeeIndex: 0, hour: 8, minute: 30 });
  assert.deepEqual(timeSlot(23 * 3, 3), { employeeIndex: 0, hour: 19, minute: 30 });
});

test("estimateRows suma citas de historial y futuras, y multiplica por salones", () => {
  const [estimate] = estimateRows([cohortOf({})]);
  assert.equal(estimate.cohort, "A");
  assert.equal(estimate.perSalon.appointments, 30 * MONTHS_OF_HISTORY + 30);
  assert.equal(estimate.perSalon.appointment_items, Math.round((30 * MONTHS_OF_HISTORY + 30) * 1.25));
  assert.equal(estimate.perSalon.retail_sales, 5 * MONTHS_OF_HISTORY);
  assert.equal(estimate.perSalon.expenses, 4 * MONTHS_OF_HISTORY);
  assert.equal(estimate.perSalon.inventory_products, 6);
  assert.equal(estimate.perSalon.inventory_movements, 0);
  assert.equal(estimate.perSalon.authUsers, 3);
  assert.equal(estimate.cohortTotals.appointments, estimate.perSalon.appointments * 2);
});

test("estimateRows omite productos si la cohorte no tiene inventario ni venta al detalle", () => {
  const [estimate] = estimateRows([cohortOf({ modules: { retail: false, inventory: false, expenses: false, reminders: false } })]);
  assert.equal(estimate.perSalon.inventory_products, 0);
  assert.equal(estimate.perSalon.retail_sales, 0);
  assert.equal(estimate.perSalon.expenses, 0);
});
