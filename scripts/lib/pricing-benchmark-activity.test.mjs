// Pruebas de los constructores de actividad del benchmark de precios v2: citas, recordatorios,
// inventario, compras, ventas de vitrina y gastos (node:test, sin red ni base de datos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAppointmentRows } from "./pricing-benchmark-appointments.mjs";
import { buildExpenseRows, buildMovementRows, buildProductRows, buildPurchaseRows, buildRetailSaleRows, buildStockRows } from "./pricing-benchmark-inventory.mjs";
import { MONTHS_OF_HISTORY } from "./pricing-benchmark-model.mjs";

/** @typedef {import("./pricing-benchmark-model.mjs").CohortConfig} CohortConfig */

/**
 * @param {Record<string, unknown>} fields
 * @returns {CohortConfig}
 */
function cohortOf(fields) {
  const base = {
    key: "A",
    label: "Cohorte A",
    salons: 1,
    collaborators: 2,
    categories: 2,
    servicesPerCategory: 2,
    customers: 5,
    appointmentsPerMonth: 30,
    futureDays: 30,
    products: 4,
    purchasesPerMonth: 1,
    retailSalesPerMonth: 1,
    expensesPerMonth: 1,
    movementsPerMonth: 1,
    modules: { retail: true, inventory: true, expenses: true, reminders: true },
    ...fields,
  };
  return /** @type {CohortConfig} */ (/** @type {unknown} */ (base));
}

const SERVICES = [
  { id: "s1", category_id: "c1", name: "Corte", duration_minutes: 30, price: 20 },
  { id: "s2", category_id: "c1", name: "Color", duration_minutes: 120, price: 80 },
  { id: "s3", category_id: "c2", name: "Manicura", duration_minutes: 45, price: 15 },
];
const EMPLOYEES = [{ id: "e1" }, { id: "e2" }];
const CUSTOMERS = [{ id: "k1" }, { id: "k2" }, { id: "k3" }, { id: "k4" }, { id: "k5" }];
const TEMPLATES = [{ id: "t1" }, { id: "t2" }];

/**
 * @param {CohortConfig} cohort
 */
function appointmentsFor(cohort) {
  return buildAppointmentRows({
    salonId: "salon-1",
    ownerId: "owner-1",
    cohort,
    cohortKey: "A",
    salonNumber: 1,
    globalSalonIndex: 1,
    batchId: "b",
    services: SERVICES,
    employees: EMPLOYEES,
    customers: CUSTOMERS,
    templates: TEMPLATES,
  });
}

test("buildAppointmentRows genera el historial mensual seguido de las citas futuras", () => {
  const { appointments, appointmentItems } = appointmentsFor(cohortOf({}));
  const futureCount = Math.round((30 / 30) * 30);
  assert.equal(appointments.length, 30 * MONTHS_OF_HISTORY + futureCount);
  const futureItems = appointmentItems.filter((item) => item.blocks_calendar === true);
  assert.equal(futureItems.length, futureCount);
});

test("las citas pasadas no bloquean agenda y las futuras sí", () => {
  const { appointments, appointmentItems } = appointmentsFor(cohortOf({}));
  const past = appointments.slice(0, 30 * MONTHS_OF_HISTORY);
  assert.ok(past.every((row) => !["scheduled", "confirmed"].includes(String(row.status))));
  assert.ok(appointmentItems.some((item) => item.blocks_calendar === false));
});

test("las citas canceladas y no-show no cobran y las completadas registran medio de pago", () => {
  const { appointments } = appointmentsFor(cohortOf({}));
  for (const row of appointments) {
    if (row.status === "cancelled" || row.status === "no_show") assert.equal(row.total_price, 0);
    if (row.status === "completed") assert.notEqual(row.payment_method, "");
  }
});

test("una cita con dos servicios genera dos líneas ordenadas", () => {
  const { appointmentItems } = appointmentsFor(cohortOf({}));
  const orderings = new Set(appointmentItems.map((item) => item.ordering));
  assert.deepEqual([...orderings].sort(), [1, 2]);
});

test("los recordatorios solo se generan si la cohorte tiene el módulo de recordatorios", () => {
  const withReminders = buildAppointmentRows({
    salonId: "salon-1",
    ownerId: null,
    cohort: cohortOf({ reminders: true }),
    cohortKey: "A",
    salonNumber: 1,
    globalSalonIndex: 1,
    batchId: "b",
    services: SERVICES,
    employees: EMPLOYEES,
    customers: CUSTOMERS,
    templates: TEMPLATES,
  });
  assert.ok(withReminders.reminderLogs.length > 0);
  assert.equal(appointmentsFor(cohortOf({ modules: { retail: true, inventory: true, expenses: true, reminders: false } })).reminderLogs.length, 0);
});

test("buildProductRows solo habilita venta al detalle con módulo de venta y omite el sexto producto", () => {
  const rows = buildProductRows({ salonId: "salon-1", cohort: cohortOf({ products: 7 }) });
  assert.equal(rows.length, 7);
  assert.equal(rows[0].is_retail_enabled, false);
  assert.equal(rows[1].is_retail_enabled, true);
  const noRetail = buildProductRows({ salonId: "salon-1", cohort: cohortOf({ products: 3, modules: { retail: false, inventory: true, expenses: false, reminders: false } }) });
  assert.ok(noRetail.every((row) => row.is_retail_enabled === false));
});

test("buildStockRows crea una fila por producto y ubicación con mínimo 8 en almacén", () => {
  const products = [{ id: "p1", cost_price: 5, sale_price: 10 }, { id: "p2", cost_price: 6, sale_price: 12 }];
  const rows = buildStockRows("salon-1", products);
  assert.equal(rows.length, 6);
  assert.equal(rows.find((row) => row.location === "storage")?.minimum_quantity, 8);
  assert.equal(rows.find((row) => row.location === "retail")?.minimum_quantity, 3);
});

test("buildMovementRows inicia con el stock inicial de cada producto", () => {
  const products = [{ id: "p1", cost_price: 5, sale_price: 10 }, { id: "p2", cost_price: 6, sale_price: 12 }];
  const rows = buildMovementRows({ salonId: "salon-1", products, cohort: cohortOf({ movementsPerMonth: 1 }), batchId: "b" });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].movement_type, "initial");
  assert.equal(rows[6].movement_type, "internal_use");
  assert.equal(rows[2].quantity_delta, -1);
});

test("buildPurchaseRows calcula el total de cada compra desde cantidad y costo unitario", () => {
  const products = [{ id: "p1", cost_price: 5.5, sale_price: 10 }];
  const { purchases, purchaseItems } = buildPurchaseRows({ salonId: "salon-1", products, cohort: cohortOf({ purchasesPerMonth: 1 }) });
  assert.equal(purchases.length, 12);
  for (const [index, item] of purchaseItems.entries()) {
    assert.equal(item.total_cost, Number((Number(item.quantity) * 5.5).toFixed(2)));
    assert.equal(purchases[index].total_cost, item.total_cost);
  }
  const off = buildPurchaseRows({ salonId: "salon-1", products, cohort: cohortOf({ modules: { retail: false, inventory: false, expenses: false, reminders: false } }) });
  assert.equal(off.purchases.length, 0);
});

test("buildRetailSaleRows relaciona el total de la venta con la línea y la clienta opcional", () => {
  const products = [{ id: "p1", cost_price: 5, sale_price: 10 }, { id: "p2", cost_price: 5, sale_price: 12.5 }];
  const { sales, saleItems } = buildRetailSaleRows({ salonId: "salon-1", products, customers: CUSTOMERS, cohort: cohortOf({ retailSalesPerMonth: 1 }) });
  assert.equal(sales.length, 12);
  assert.equal(saleItems.length, 12);
  for (const [index, sale] of sales.entries()) {
    assert.equal(sale.total_amount, saleItems[index].total_price);
  }
  assert.equal(sales[0].customer_id, CUSTOMERS[0].id);
  assert.equal(sales[1].customer_id, null);
});

test("buildExpenseRows usa el concepto como categoría personalizada cuando la categoría es other", () => {
  const rows = buildExpenseRows({ salonId: "salon-1", cohort: cohortOf({ expensesPerMonth: 1 }) });
  assert.equal(rows.length, 12);
  const other = rows.find((row) => row.category === "other");
  assert.equal(other?.custom_category, other?.concept);
  assert.equal(rows[0].custom_category, null);
});
