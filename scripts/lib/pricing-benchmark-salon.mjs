// Siembra de un salón del benchmark de precios v2: orquesta las inserciones (en el mismo orden que
// antes) a partir de los constructores puros. Recibe el cliente admin y los parámetros del lote.
import { ownerEmailFor } from "../pricing-benchmark-shared.mjs";
import { requireRow } from "../seed-common.mjs";
import { buildAppointmentRows } from "./pricing-benchmark-appointments.mjs";
import { createAuthUser, createInserter } from "./pricing-benchmark-io.mjs";
import { buildExpenseRows, buildMovementRows, buildProductRows, buildPurchaseRows, buildRetailSaleRows, buildStockRows } from "./pricing-benchmark-inventory.mjs";
import {
  buildBusinessHourRows,
  buildCategoryRows,
  buildCollaboratorProfileRows,
  buildCustomerRows,
  buildEmployeeLinkRows,
  buildEmployeeRows,
  buildRolePermissionRows,
  buildRoleRows,
  buildSalonRow,
  buildServiceRows,
  buildStaffPlan,
  buildTemplateRows,
} from "./pricing-benchmark-rows.mjs";

/**
 * @typedef {import("../types/seeds.d.cts").ServiceRow} ServiceRow
 * @typedef {import("../types/seeds.d.cts").ProductRow} ProductRow
 * @typedef {import("../types/seeds.d.cts").SeedSummary} SeedSummary
 * @typedef {ReturnType<typeof import("../pricing-benchmark-shared.mjs").getSelectedCohorts>[number]} CohortConfig
 * @typedef {import("@supabase/supabase-js").SupabaseClient} SupabaseClient
 */

/**
 * @typedef {object} SalonArgs
 * @property {SupabaseClient} admin
 * @property {CohortConfig} cohort
 * @property {string} batchId
 * @property {number} salonNumber
 * @property {number} globalSalonIndex
 * @property {SeedSummary} summary
 * @property {{ id: string, key: string }[]} permissionIds
 * @property {string} password
 * @property {boolean} allowSynthetic
 * @property {number} batchSize
 */

/**
 * Inserta horario, plantillas de recordatorio, categorías y servicios; devuelve las filas con ids.
 * @param {(table: string, rows: unknown[], select?: string) => Promise<import("../types/seeds.d.cts").DbRow[]>} insert
 * @param {CohortConfig} cohort
 * @param {string} salonId
 */
async function seedCatalog(insert, cohort, salonId) {
  await insert("salon_business_hours", buildBusinessHourRows(salonId));
  const templates = await insert("notification_templates", buildTemplateRows(salonId), "id, channel");
  const categories = /** @type {{ id: string, name: string }[]} */ (await insert("service_categories", buildCategoryRows(salonId, cohort), "id, name"));
  const services = /** @type {ServiceRow[]} */ (await insert("services", buildServiceRows(salonId, cohort, categories), "id, category_id, duration_minutes, price, name"));
  return { templates, categories, services };
}

/**
 * Siembra un salón completo: dueño, personal, catálogo, clientas, citas, inventario y gastos.
 * @param {SalonArgs} args
 * @returns {Promise<void>}
 */
export async function seedSalon(args) {
  const { admin, cohort, batchId, salonNumber, globalSalonIndex, summary, permissionIds, password, allowSynthetic, batchSize } = args;
  const cohortKey = cohort.key;
  const insert = createInserter({ admin, summary, cohortKey, batchSize });
  const createUser = (/** @type {string} */ email, /** @type {string} */ fullName) =>
    createAuthUser({ admin, email, fullName, password, allowSynthetic });

  const ownerEmail = ownerEmailFor(batchId, cohortKey, salonNumber);
  const ownerId = await createUser(ownerEmail, `${cohort.label} Owner ${salonNumber}`);
  summary.cohorts[cohortKey].authUsers += 1;
  summary.accounts.push({ cohort: cohortKey, salon: `${cohort.label} ${salonNumber}`, email: ownerEmail });

  const [salon] = await insert("salons", [buildSalonRow({ cohort, cohortKey, salonNumber, globalSalonIndex, ownerEmail })], "id");
  const salonId = salon.id;

  const roles = await insert("roles", buildRoleRows(salonId), "id, name");
  const ownerRole = requireRow(roles, (role) => role.name === "Owner", "rol Owner");
  const collaboratorRole = requireRow(roles, (role) => role.name === "Colaborador", "rol Colaborador");

  await insert("profiles", [{
    id: ownerId,
    salon_id: salonId,
    full_name: `${cohort.label} Owner ${salonNumber}`,
    role_id: ownerRole.id,
    is_owner: true,
    is_active: true,
  }]);

  await insert("role_permissions", buildRolePermissionRows({
    salonId,
    ownerRoleId: ownerRole.id,
    collaboratorRoleId: collaboratorRole.id,
    permissionIds,
  }));

  const { templates, categories, services } = await seedCatalog(insert, cohort, salonId);

  const staff = buildStaffPlan(cohort, { batchId, cohortKey, salonNumber, globalSalonIndex });
  /** @type {(string | null)[]} */
  const profileIds = [];
  for (const person of staff) {
    profileIds.push(await createUser(person.email, person.fullName));
    summary.cohorts[cohortKey].authUsers += 1;
  }
  await insert("profiles", buildCollaboratorProfileRows({ salonId, collaboratorRoleId: collaboratorRole.id, staff, profileIds }));

  const employees = await insert("employees", buildEmployeeRows({ salonId, categories, globalSalonIndex, staff, profileIds }), "id");
  const links = buildEmployeeLinkRows({ salonId, employees, services, categories });
  await insert("employee_services", links.employeeServices);
  await insert("employee_categories", links.employeeCategories);
  await insert("work_schedules", links.workSchedules);

  const customers = await insert("customers", buildCustomerRows({ salonId, cohort, cohortKey, batchId, salonNumber, globalSalonIndex }), "id");

  const activity = buildAppointmentRows({ salonId, ownerId, cohort, cohortKey, salonNumber, globalSalonIndex, batchId, services, employees, customers, templates });
  await insert("appointments", activity.appointments);
  await insert("appointment_items", activity.appointmentItems);
  await insert("appointment_reminder_log", activity.reminderLogs);

  if (cohort.modules.retail || cohort.modules.inventory) {
    const products = /** @type {ProductRow[]} */ (await insert("inventory_products", buildProductRows({ salonId, cohort }), "id, cost_price, sale_price"));
    await insert("inventory_stock_locations", buildStockRows(salonId, products));
    await insert("inventory_movements", buildMovementRows({ salonId, products, cohort, batchId }));

    const purchases = buildPurchaseRows({ salonId, products, cohort });
    await insert("inventory_purchases", purchases.purchases);
    await insert("inventory_purchase_items", purchases.purchaseItems);

    if (cohort.modules.retail) {
      const retail = buildRetailSaleRows({ salonId, products, customers, cohort });
      await insert("retail_sales", retail.sales);
      await insert("retail_sale_items", retail.saleItems);
    }
  }

  if (cohort.modules.expenses) {
    await insert("expenses", buildExpenseRows({ salonId, cohort }));
  }
}
