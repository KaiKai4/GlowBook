// Constructores puros de inventario, compras, ventas de vitrina y gastos del benchmark de precios v2.
import { randomUUID } from "node:crypto";
import { dateAt, dateOnly } from "../seed-common.mjs";
import { PAYMENT_METHODS } from "../pricing-benchmark-shared.mjs";
import { EXPENSES, PRODUCT_CATEGORIES } from "../seed-pricing-benchmark-catalog.mjs";
import { money, MONTHS_OF_HISTORY } from "./pricing-benchmark-model.mjs";

/**
 * @typedef {ReturnType<typeof import("../pricing-benchmark-shared.mjs").getSelectedCohorts>[number]} CohortConfig
 * @typedef {{ id: string, cost_price: number, sale_price: number }} ProductLike
 */

/** Ubicaciones de stock del benchmark. */
const LOCATIONS = ["retail", "internal", "storage"];

/**
 * Productos de la cohorte (solo si tiene módulo de inventario o de venta al detalle).
 * @param {{ salonId: string, cohort: CohortConfig }} args
 */
export function buildProductRows({ salonId, cohort }) {
  return Array.from({ length: cohort.products ?? 0 }, (_, index) => {
    const category = PRODUCT_CATEGORIES[index % PRODUCT_CATEGORIES.length];
    const cost = 4 + (index % 18) * 1.25;
    return {
      salon_id: salonId,
      name: `${category} Producto ${index + 1}`,
      category,
      cost_price: money(cost),
      sale_price: money(cost * 2.2),
      is_active: true,
      is_retail_enabled: cohort.modules.retail && index % 6 !== 0,
      deleted_at: null,
    };
  });
}

/**
 * Stock inicial por producto y ubicación.
 * @param {string} salonId
 * @param {ProductLike[]} products
 */
export function buildStockRows(salonId, products) {
  return products.flatMap((product, index) =>
    LOCATIONS.map((location, locationIndex) => ({
      salon_id: salonId,
      product_id: product.id,
      location,
      quantity: 10 + ((index + locationIndex) % 30),
      minimum_quantity: location === "storage" ? 8 : 3,
    }))
  );
}

/**
 * Movimientos de inventario: primero el stock inicial de cada producto y luego altas, ventas, usos y ajustes.
 * @param {{ salonId: string, products: ProductLike[], cohort: CohortConfig, batchId: string }} args
 */
export function buildMovementRows({ salonId, products, cohort, batchId }) {
  const movementCount = cohort.modules.inventory ? (cohort.movementsPerMonth ?? 0) * MONTHS_OF_HISTORY : products.length * 3;
  return Array.from({ length: movementCount }, (_, index) => {
    const product = products[index % products.length];
    return {
      salon_id: salonId,
      product_id: product.id,
      location: LOCATIONS[index % 3],
      movement_type: index < products.length * 3 ? "initial" : ["purchase", "retail_sale", "internal_use", "adjustment"][index % 4],
      quantity_delta: index % 4 === 2 ? -1 : 4 + (index % 7),
      quantity_after: 15 + (index % 25),
      reference_type: "pricing_benchmark",
      reference_id: null,
      note: `Benchmark ${batchId}`,
      created_at: dateAt(-360 + (index % 360), 12).toISOString(),
    };
  });
}

/**
 * Compras de reposición con sus líneas (solo con módulo de inventario).
 * @param {{ salonId: string, products: ProductLike[], cohort: CohortConfig }} args
 * @returns {{ purchases: Record<string, unknown>[], purchaseItems: Record<string, unknown>[] }}
 */
export function buildPurchaseRows({ salonId, products, cohort }) {
  /** @type {Record<string, unknown>[]} */
  const purchases = [];
  /** @type {Record<string, unknown>[]} */
  const purchaseItems = [];
  const purchaseCount = cohort.modules.inventory ? (cohort.purchasesPerMonth ?? 0) * MONTHS_OF_HISTORY : 0;
  for (let index = 0; index < purchaseCount; index += 1) {
    const product = products[index % products.length];
    const quantity = 5 + (index % 10);
    const totalCost = money(quantity * Number(product.cost_price));
    const id = randomUUID();
    purchases.push({
      id,
      salon_id: salonId,
      supplier_name: `Proveedor ${1 + (index % 8)}`,
      purchase_date: dateOnly(dateAt(-360 + (index % 360), 12)),
      total_cost: totalCost,
      note: "Reposicion benchmark.",
    });
    purchaseItems.push({
      salon_id: salonId,
      purchase_id: id,
      product_id: product.id,
      location: index % 3 === 0 ? "retail" : "storage",
      quantity,
      unit_cost: product.cost_price,
      total_cost: totalCost,
    });
  }
  return { purchases, purchaseItems };
}

/**
 * Ventas de vitrina sobre los productos con venta al detalle habilitada (uno de cada seis se excluye).
 * @param {{ salonId: string, products: ProductLike[], customers: { id: string }[], cohort: CohortConfig }} args
 * @returns {{ sales: Record<string, unknown>[], saleItems: Record<string, unknown>[] }}
 */
export function buildRetailSaleRows({ salonId, products, customers, cohort }) {
  /** @type {Record<string, unknown>[]} */
  const sales = [];
  /** @type {Record<string, unknown>[]} */
  const saleItems = [];
  const retailProducts = products.filter((_, index) => index % 6 !== 0);
  for (let index = 0; index < (cohort.retailSalesPerMonth ?? 0) * MONTHS_OF_HISTORY; index += 1) {
    const product = retailProducts[index % retailProducts.length];
    const quantity = 1 + (index % 2);
    const total = money(quantity * Number(product.sale_price));
    const id = randomUUID();
    sales.push({
      id,
      salon_id: salonId,
      customer_id: index % 3 === 0 ? customers[index % customers.length].id : null,
      sale_date: dateAt(-360 + (index % 360), 18, 15).toISOString(),
      payment_method: PAYMENT_METHODS[index % PAYMENT_METHODS.length],
      total_amount: total,
      note: "Venta benchmark.",
    });
    saleItems.push({
      salon_id: salonId,
      sale_id: id,
      product_id: product.id,
      location: "retail",
      quantity,
      unit_price: product.sale_price,
      total_price: total,
    });
  }
  return { sales, saleItems };
}

/**
 * Gastos del periodo del benchmark (solo con módulo de gastos).
 * @param {{ salonId: string, cohort: CohortConfig }} args
 */
export function buildExpenseRows({ salonId, cohort }) {
  return Array.from({ length: (cohort.expensesPerMonth ?? 0) * MONTHS_OF_HISTORY }, (_, index) => {
    const [category, concept, vendorName] = EXPENSES[index % EXPENSES.length];
    return {
      salon_id: salonId,
      expense_date: dateOnly(dateAt(-360 + (index % 360), 12)),
      category,
      custom_category: category === "other" ? concept : null,
      concept,
      amount: money(35 + (index % 20) * 7.5),
      vendor_name: vendorName,
      note: "Gasto benchmark.",
    };
  });
}
