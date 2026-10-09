// Constructores puros de citas, inventario, compras, ventas de vitrina y gastos del estudio de precios.
import { randomUUID } from "node:crypto";
import { addMinutes, dateAt, dateOnly } from "../seed-common.mjs";
import { EXPENSES, PAYMENT_METHODS, PRODUCTS } from "./pricing-study-catalog.mjs";
import { roundMoney } from "./pricing-study-rows.mjs";

/**
 * @typedef {import("../types/seeds.d.cts").ProductRow} ProductRow
 */

/** Ubicaciones donde el estudio guarda stock. */
const STOCK_LOCATIONS = ["retail", "internal", "storage"];

/**
 * Estado de la cita por índice: 60% completadas, resto cancelada, confirmada, agendada o no-show.
 * @param {number} index
 * @returns {string}
 */
function appointmentStatus(index) {
  const mod = index % 20;
  if (mod < 12) return "completed";
  if (mod < 15) return "cancelled";
  if (mod < 17) return "confirmed";
  if (mod < 19) return "scheduled";
  return "no_show";
}

/**
 * Desplazamiento en días de la cita: 160 pasadas repartidas en 120 días, luego futuras.
 * @param {number} index
 * @returns {number}
 */
function appointmentOffset(index) {
  if (index < 160) return -120 + Math.floor(index * 120 / 160);
  return 1 + (index - 160);
}

/**
 * Construye 180 citas (cabecera) y sus líneas de servicio (1 o 2 por cita).
 * @param {{ salonId: string, ownerId: string, salonIndex: number, services: import("../types/seeds.d.cts").ServiceRow[], employees: { id: string }[], customers: { id: string }[] }} args
 * @returns {{ appointments: Record<string, unknown>[], appointmentItems: Record<string, unknown>[] }}
 */
export function buildAppointmentRows({ salonId, ownerId, salonIndex, services, employees, customers }) {
  /** @type {Record<string, unknown>[]} */
  const appointments = [];
  /** @type {Record<string, unknown>[]} */
  const appointmentItems = [];
  for (let index = 0; index < 180; index += 1) {
    const service = services[(index + salonIndex) % services.length];
    const serviceTwo = index % 4 === 0 ? services[(index + salonIndex + 3) % services.length] : null;
    const totalDuration = service.duration_minutes + (serviceTwo?.duration_minutes ?? 0);
    const offset = appointmentOffset(index);
    const hour = 14 + (index % 7);
    const minute = index % 2 === 0 ? 0 : 30;
    const start = dateAt(offset, hour, minute);
    const end = addMinutes(start, totalDuration);
    const status = appointmentStatus(index);
    const blocksCalendar = (status === "scheduled" || status === "confirmed") && offset > 0;
    const totalPrice = roundMoney(service.price + (serviceTwo?.price ?? 0));
    const discount = status === "completed" && index % 11 === 0 ? 2 : 0;
    const appointmentId = randomUUID();

    appointments.push({
      id: appointmentId,
      salon_id: salonId,
      customer_id: customers[index % customers.length].id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status,
      total_price: status === "cancelled" || status === "no_show" ? 0 : roundMoney(totalPrice - discount),
      discount_amount: discount,
      payment_method: status === "completed" ? PAYMENT_METHODS[index % PAYMENT_METHODS.length] : "",
      completion_price_note: status === "completed" && discount > 0 ? "Descuento de fidelidad." : "",
      notes: status === "cancelled" ? "Cancelada por el cliente." : "",
      created_by: ownerId,
      created_at: addMinutes(start, -60 * 24 * 7).toISOString(),
      updated_at: addMinutes(start, status === "completed" ? totalDuration + 10 : -30).toISOString(),
    });

    appointmentItems.push({
      appointment_id: appointmentId,
      salon_id: salonId,
      service_id: service.id,
      employee_id: employees[index % employees.length].id,
      start_time: start.toISOString(),
      end_time: addMinutes(start, service.duration_minutes).toISOString(),
      duration_minutes: service.duration_minutes,
      price: service.price,
      discount_amount: discount,
      ordering: 1,
      blocks_calendar: blocksCalendar,
    });

    if (serviceTwo) {
      const secondStart = addMinutes(start, service.duration_minutes);
      appointmentItems.push({
        appointment_id: appointmentId,
        salon_id: salonId,
        service_id: serviceTwo.id,
        employee_id: employees[(index + 1) % employees.length].id,
        start_time: secondStart.toISOString(),
        end_time: addMinutes(secondStart, serviceTwo.duration_minutes).toISOString(),
        duration_minutes: serviceTwo.duration_minutes,
        price: serviceTwo.price,
        discount_amount: 0,
        ordering: 2,
        blocks_calendar: blocksCalendar,
      });
    }
  }
  return { appointments, appointmentItems };
}

/**
 * @param {string} salonId
 * @param {number} salonIndex
 */
export function buildProductRows(salonId, salonIndex) {
  return PRODUCTS.map(([name, category, cost, sale], index) => ({
    salon_id: salonId,
    name,
    category,
    cost_price: roundMoney(cost + salonIndex * 0.4),
    sale_price: roundMoney(sale + salonIndex),
    is_active: true,
    is_retail_enabled: index % 5 !== 4,
    deleted_at: null,
  }));
}

/**
 * Cantidad inicial determinista de stock por producto, ubicación y salón.
 * @param {number} index
 * @param {number} locationIndex
 * @param {number} salonIndex
 */
function initialQuantity(index, locationIndex, salonIndex) {
  return 18 + ((index + locationIndex + salonIndex) % 14);
}

/**
 * @param {string} salonId
 * @param {ProductRow[]} products
 * @param {number} salonIndex
 */
export function buildStockLocationRows(salonId, products, salonIndex) {
  return products.flatMap((product, index) =>
    STOCK_LOCATIONS.map((location, locationIndex) => ({
      salon_id: salonId,
      product_id: product.id,
      location,
      quantity: initialQuantity(index, locationIndex, salonIndex),
      minimum_quantity: location === "storage" ? 6 : 3,
    }))
  );
}

/**
 * Movimiento inicial de stock por producto y ubicación.
 * @param {string} salonId
 * @param {ProductRow[]} products
 * @param {number} salonIndex
 * @param {string} batchId
 */
export function buildInitialMovementRows(salonId, products, salonIndex, batchId) {
  return products.flatMap((product, index) =>
    STOCK_LOCATIONS.map((location, locationIndex) => {
      const quantity = initialQuantity(index, locationIndex, salonIndex);
      return {
        salon_id: salonId,
        product_id: product.id,
        location,
        movement_type: "initial",
        quantity_delta: quantity,
        quantity_after: quantity,
        reference_type: "pricing_seed",
        reference_id: null,
        note: `Stock inicial ${batchId}`,
      };
    })
  );
}

/**
 * 16 compras de reposición con sus líneas; el costo total de cada línea es cantidad por costo unitario.
 * @param {string} salonId
 * @param {ProductRow[]} products
 * @param {number} salonIndex
 * @returns {{ purchases: Record<string, unknown>[], purchaseItems: Record<string, unknown>[] }}
 */
export function buildPurchaseRows(salonId, products, salonIndex) {
  /** @type {Record<string, unknown>[]} */
  const purchases = [];
  /** @type {Record<string, unknown>[]} */
  const purchaseItems = [];
  for (let index = 0; index < 16; index += 1) {
    const product = products[(index + salonIndex) % products.length];
    const quantity = 6 + (index % 5);
    const unitCost = Number(product.cost_price);
    const totalCost = roundMoney(quantity * unitCost);
    const purchaseId = randomUUID();
    purchases.push({
      id: purchaseId,
      salon_id: salonId,
      supplier_name: `Proveedor ${1 + (index % 4)}`,
      purchase_date: dateOnly(dateAt(-118 + index * 7, 12)),
      total_cost: totalCost,
      note: "Reposicion para estudio de costos.",
    });
    purchaseItems.push({
      salon_id: salonId,
      purchase_id: purchaseId,
      product_id: product.id,
      location: index % 3 === 0 ? "retail" : "storage",
      quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
    });
  }
  return { purchases, purchaseItems };
}

/**
 * 80 ventas de vitrina sobre los productos con venta al detalle habilitada.
 * @param {string} salonId
 * @param {ProductRow[]} products
 * @param {{ id: string }[]} customers
 * @param {number} salonIndex
 * @returns {{ retailSales: Record<string, unknown>[], retailSaleItems: Record<string, unknown>[] }}
 */
export function buildRetailSaleRows(salonId, products, customers, salonIndex) {
  /** @type {Record<string, unknown>[]} */
  const retailSales = [];
  /** @type {Record<string, unknown>[]} */
  const retailSaleItems = [];
  const retailProducts = products.filter((_, index) => index % 5 !== 4);
  for (let index = 0; index < 80; index += 1) {
    const product = retailProducts[(index + salonIndex) % retailProducts.length];
    const quantity = 1 + (index % 2);
    const unitPrice = Number(product.sale_price);
    const totalPrice = roundMoney(quantity * unitPrice);
    const saleId = randomUUID();
    retailSales.push({
      id: saleId,
      salon_id: salonId,
      customer_id: index % 3 === 0 ? customers[index % customers.length].id : null,
      sale_date: dateAt(-118 + index, 18, 15).toISOString(),
      payment_method: PAYMENT_METHODS[(index + 1) % PAYMENT_METHODS.length],
      total_amount: totalPrice,
      note: "Venta de vitrina para medicion de plan.",
    });
    retailSaleItems.push({
      salon_id: salonId,
      sale_id: saleId,
      product_id: product.id,
      location: "retail",
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });
  }
  return { retailSales, retailSaleItems };
}

/**
 * 32 gastos operativos repartidos en el periodo del estudio.
 * @param {string} salonId
 * @param {number} salonIndex
 */
export function buildExpenseRows(salonId, salonIndex) {
  return Array.from({ length: 32 }, (_, index) => {
    const [category, concept, vendorName] = EXPENSES[index % EXPENSES.length];
    return {
      salon_id: salonId,
      expense_date: dateOnly(dateAt(-118 + index * 4, 12)),
      category,
      custom_category: category === "other" ? concept : null,
      concept,
      amount: roundMoney(35 + (index % 8) * 18 + salonIndex * 5),
      vendor_name: vendorName,
      note: "Gasto operativo para estudio de precios.",
    };
  });
}
