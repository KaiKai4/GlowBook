// Pruebas de los constructores puros del estudio de precios (node:test, sin red ni base de datos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_BLUEPRINTS, EMPLOYEE_NAMES, PRODUCTS } from "./pricing-study-catalog.mjs";
import {
  buildBusinessHourRows,
  buildCategoryRows,
  buildCustomerRows,
  buildEmployeeRows,
  buildServiceRows,
  buildWorkScheduleRows,
} from "./pricing-study-rows.mjs";
import {
  buildAppointmentRows,
  buildExpenseRows,
  buildInitialMovementRows,
  buildProductRows,
  buildPurchaseRows,
  buildRetailSaleRows,
  buildStockLocationRows,
} from "./pricing-study-activity.mjs";

const SERVICES = [
  { id: "s1", category_id: "c1", name: "Corte", duration_minutes: 30, price: 20 },
  { id: "s2", category_id: "c1", name: "Color", duration_minutes: 90, price: 70 },
  { id: "s3", category_id: "c2", name: "Manicura", duration_minutes: 45, price: 15.5 },
];
const EMPLOYEES = [{ id: "e1" }, { id: "e2" }, { id: "e3" }];
const CUSTOMERS = [{ id: "k1" }, { id: "k2" }, { id: "k3" }];
const PRODUCT_ROWS = [
  { id: "p1", cost_price: 8.5, sale_price: 18.5 },
  { id: "p2", cost_price: 4, sale_price: 10 },
  { id: "p3", cost_price: 6, sale_price: 14 },
  { id: "p4", cost_price: 3, sale_price: 8 },
  { id: "p5", cost_price: 7, sale_price: 16 },
];

test("buildBusinessHourRows cierra el domingo y cambia el horario de cierre entre semana", () => {
  const rows = buildBusinessHourRows("salon-1");
  assert.equal(rows.length, 7);
  assert.equal(rows[0].is_open, false);
  assert.equal(rows[2].close_time, "21:00");
  assert.equal(rows[3].close_time, "18:00");
});

test("buildCategoryRows toma todas las categorías del estudio con descripción en minúsculas", () => {
  const rows = buildCategoryRows("salon-1");
  assert.equal(rows.length, CATEGORY_BLUEPRINTS.length);
  assert.equal(rows[0].name, CATEGORY_BLUEPRINTS[0].name);
  assert.equal(rows[0].description, `Servicios de ${CATEGORY_BLUEPRINTS[0].name.toLowerCase()} para estudio de precios.`);
});

test("buildServiceRows suma el índice del salón al precio y conserva la categoría", () => {
  const categories = CATEGORY_BLUEPRINTS.map((_, index) => ({ id: `cat-${index}` }));
  const rows = buildServiceRows("salon-1", categories, 2);
  const expected = CATEGORY_BLUEPRINTS.reduce((total, category) => total + category.services.length, 0);
  assert.equal(rows.length, expected);
  assert.equal(rows[0].price, CATEGORY_BLUEPRINTS[0].services[0][2] + 2);
  assert.equal(rows[0].category_id, "cat-0");
});

test("buildEmployeeRows genera una fila por empleada con comisiones alternas", () => {
  const rows = buildEmployeeRows("salon-1", "pricing-b1", 3);
  assert.equal(rows.length, EMPLOYEE_NAMES.length);
  assert.deepEqual(rows.map((row) => row.commission_percentage), EMPLOYEE_NAMES.map((_, index) => (index % 2 === 0 ? 35 : 40)));
  assert.match(String(rows[0].hire_date), /^\d{4}-\d{2}-\d{2}$/);
});

test("buildWorkScheduleRows: lunes y martes cierran a las 21:00", () => {
  const rows = buildWorkScheduleRows("salon-1", EMPLOYEES);
  assert.equal(rows.length, EMPLOYEES.length * 6);
  const monday = rows.find((row) => row.day_of_week === 1);
  const thursday = rows.find((row) => row.day_of_week === 4);
  assert.equal(monday?.end_time, "21:00");
  assert.equal(thursday?.end_time, "18:00");
});

test("buildCustomerRows genera 90 clientas con una inactiva cada 29", () => {
  const rows = buildCustomerRows("salon-1", "pricing-b1", 2);
  assert.equal(rows.length, 90);
  assert.equal(rows[0].is_active, false);
  assert.equal(rows[1].is_active, true);
  assert.equal(rows[0].birth_date, "1990-01-15");
  assert.equal(rows[1].birth_date, null);
  assert.notEqual(rows[5].birth_date, null);
});

test("buildAppointmentRows crea 180 citas y una línea por servicio adicional", () => {
  const { appointments, appointmentItems } = buildAppointmentRows({
    salonId: "salon-1",
    ownerId: "owner-1",
    salonIndex: 1,
    services: SERVICES,
    employees: EMPLOYEES,
    customers: CUSTOMERS,
  });
  assert.equal(appointments.length, 180);
  const secondLines = Math.ceil(180 / 4);
  assert.equal(appointmentItems.length, 180 + secondLines);
  for (const row of appointments) {
    if (row.status === "cancelled" || row.status === "no_show") assert.equal(row.total_price, 0);
    assert.equal(row.created_by, "owner-1");
  }
});

test("buildProductRows excluye de la venta al detalle uno de cada cinco productos", () => {
  const rows = buildProductRows("salon-1", 1);
  assert.equal(rows.length, PRODUCTS.length);
  assert.equal(rows[4].is_retail_enabled, false);
  assert.equal(rows[0].is_retail_enabled, true);
  assert.equal(rows[0].cost_price, Number((PRODUCTS[0][2] + 0.4).toFixed(2)));
});

test("buildStockLocationRows y buildInitialMovementRows usan cantidades iguales en el movimiento inicial", () => {
  const stock = buildStockLocationRows("salon-1", PRODUCT_ROWS, 1);
  const moves = buildInitialMovementRows("salon-1", PRODUCT_ROWS, 1, "pricing-b1");
  assert.equal(stock.length, PRODUCT_ROWS.length * 3);
  assert.equal(moves.length, stock.length);
  for (const [index, move] of moves.entries()) {
    assert.equal(move.quantity_delta, stock[index].quantity);
    assert.equal(move.quantity_after, stock[index].quantity);
    assert.equal(move.movement_type, "initial");
  }
  assert.equal(stock.find((row) => row.location === "storage")?.minimum_quantity, 6);
});

test("buildPurchaseRows deja el total de cada compra igual a la suma de su línea", () => {
  const { purchases, purchaseItems } = buildPurchaseRows("salon-1", PRODUCT_ROWS, 2);
  assert.equal(purchases.length, 16);
  assert.equal(purchaseItems.length, 16);
  for (const [index, purchase] of purchases.entries()) {
    assert.equal(purchase.total_cost, purchaseItems[index].total_cost);
  }
});

test("buildRetailSaleRows vende solo productos con venta al detalle habilitada", () => {
  const { retailSales, retailSaleItems } = buildRetailSaleRows("salon-1", PRODUCT_ROWS, CUSTOMERS, 1);
  assert.equal(retailSales.length, 80);
  assert.equal(retailSaleItems.length, 80);
  assert.ok(retailSaleItems.every((item) => item.location === "retail"));
  assert.ok(retailSaleItems.every((item) => item.product_id !== "p5"));
});

test("buildExpenseRows genera 32 gastos y repite la categoría other con concepto personalizado", () => {
  const rows = buildExpenseRows("salon-1", 1);
  assert.equal(rows.length, 32);
  const other = rows.find((row) => row.category === "other");
  assert.equal(other?.custom_category, other?.concept);
  assert.equal(rows[0].custom_category, null);
});
