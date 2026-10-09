import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertSafeTargetOrExit, readConfirmFlag } from "./lib/target-guard.mjs";
import { assertNotProductionUrl, assertSeedEnvironment, chunk, emailFor, loadEnvFileIfPresent, readAppEnv } from "./seed-common.mjs";

/**
 * @typedef {{ id: string, [column: string]: unknown }} DbRow
 * @typedef {DbRow & { category_id: string, name: string, duration_minutes: number, price: number }} ServiceRow
 * @typedef {DbRow & { cost_price: number, sale_price: number }} ProductRow
 * @typedef {{ tables: Record<string, { rows: number, jsonBytes: number }>, authUsers: number, owners: { salon: string, email: string }[], batchId: string, password: string }} StudySummary
 */

const PASSWORD = "GlowBookPricing123!";
const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Yappy", "Transferencia", "Zinli"];

const SALON_BLUEPRINTS = [
  { name: "GlowBook Pricing Studio 1", theme: "violet", primaryColor: "#7C3AED" },
  { name: "GlowBook Pricing Studio 2", theme: "orchid", primaryColor: "#9333EA" },
  { name: "GlowBook Pricing Studio 3", theme: "aqua", primaryColor: "#2563EB" },
  { name: "GlowBook Pricing Studio 4", theme: "mint", primaryColor: "#059669" },
  { name: "GlowBook Pricing Studio 5", theme: "rose", primaryColor: "#DB2777" },
  { name: "GlowBook Pricing Studio 6", theme: "indigo", primaryColor: "#4F46E5" },
];

/** @type {{ name: string, pricing_mode: string, services: [string, number, number][] }[]} */
const CATEGORY_BLUEPRINTS = [
  {
    name: "Cabello",
    pricing_mode: "fixed",
    services: [
      ["Corte y secado", 45, 28],
      ["Color completo", 120, 85],
      ["Tratamiento hidratante", 60, 45],
    ],
  },
  {
    name: "Unas",
    pricing_mode: "variable",
    services: [
      ["Manicura tradicional", 35, 18],
      ["Softgel", 75, 35],
      ["Acrilico", 90, 45],
    ],
  },
  {
    name: "Estetica",
    pricing_mode: "fixed",
    services: [
      ["Limpieza facial", 70, 55],
      ["Depilacion de cejas", 30, 20],
      ["Pestanas lifting", 65, 40],
    ],
  },
  {
    name: "Masaje",
    pricing_mode: "fixed",
    services: [
      ["Relajante", 50, 30],
      ["Deportivo", 80, 55],
      ["Cuerpo completo", 100, 75],
    ],
  },
];

const EMPLOYEE_NAMES = [
  ["Ana", "Morrison", "Cabello"],
  ["Valeria", "Castillo", "Unas"],
  ["Nohemy", "Valderrama", "Estetica"],
  ["Karla", "Rodriguez", "Unas"],
  ["Genesis", "Rivas", "Masaje"],
  ["Laura", "Mendez", "Cabello"],
];

const FIRST_NAMES = [
  "Alejandra",
  "Allan",
  "Camila",
  "Daniela",
  "Elena",
  "Fabiana",
  "Gabriel",
  "Isabella",
  "Juan",
  "Karla",
  "Keily",
  "Maria",
  "Nohemy",
  "Sara",
  "Sofia",
  "Valery",
  "Victoria",
  "Yamileth",
];

const LAST_NAMES = [
  "Nunez",
  "Ordonez",
  "Herrera",
  "Rodriguez",
  "Sanchez",
  "Pitty",
  "Villanueva",
  "Martinez",
  "Perez",
  "Castillo",
  "Morales",
  "Rojas",
];

/** @type {[string, string, number, number][]} */
const PRODUCTS = [
  ["Shampoo hidratante", "Cabello", 8, 18],
  ["Acondicionador reparador", "Cabello", 7, 16],
  ["Mascarilla capilar", "Cabello", 12, 28],
  ["Aceite de cuticula", "Unas", 4, 10],
  ["Base coat", "Unas", 6, 14],
  ["Top coat brillo", "Unas", 7, 16],
  ["Serum facial", "Estetica", 14, 32],
  ["Protector solar facial", "Estetica", 10, 24],
  ["Crema hidratante", "Estetica", 9, 22],
  ["Aceite de masaje", "Masaje", 11, 26],
  ["Exfoliante corporal", "Masaje", 13, 30],
  ["Vela aromatica", "Complementos", 5, 12],
  ["Gel fijador", "Cabello", 6, 15],
  ["Removedor sin acetona", "Unas", 3, 8],
  ["Bruma facial", "Estetica", 8, 20],
];

const EXPENSES = [
  ["rent", "Alquiler mensual", "Administracion Plaza"],
  ["utilities", "Servicios basicos", "Ensa / Idaan"],
  ["supplies", "Suministros de salon", "Distribuidora Belleza"],
  ["payroll", "Comisiones y apoyo", "Equipo interno"],
  ["maintenance", "Mantenimiento de equipos", "Tecnico certificado"],
  ["other", "Publicidad local", "Campanas digitales"],
  ["other", "Lavanderia", "Proveedor local"],
  ["supplies", "Insumos descartables", "Proveedor mayorista"],
];

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[seed-pricing-study] ${message}`);
  process.exit(1);
}

/** @param {string} batchId */
function assertSafeBatchId(batchId) {
  if (!/^pricing-[a-zA-Z0-9-]+$/.test(batchId)) {
    fail("PRICING_STUDY_BATCH_ID must start with 'pricing-' and contain only letters, numbers and hyphens.");
  }
}

/** @param {{ tables: Record<string, { rows: number, jsonBytes: number }> }} summary @param {string} table @param {unknown[]} rows @returns {void} */
function addPayloadBytes(summary, table, rows) {
  if (!summary.tables[table]) summary.tables[table] = { rows: 0, jsonBytes: 0 };
  summary.tables[table].rows += rows.length;
  summary.tables[table].jsonBytes += Buffer.byteLength(JSON.stringify(rows), "utf8");
}

/** @param {import("@supabase/supabase-js").SupabaseClient} admin @param {string} table @param {unknown[]} rows @param {{ tables: Record<string, { rows: number, jsonBytes: number }> }} summary @param {string} [select] @returns {Promise<DbRow[]>} */
async function insertRows(admin, table, rows, summary, select = undefined) {
  if (rows.length === 0) return [];
  addPayloadBytes(summary, table, rows);

  /** @type {DbRow[]} */
  const inserted = [];
  for (const group of chunk(rows)) {
    const insertQuery = admin.from(table).insert(group);
    const query = select ? insertQuery.select(select) : insertQuery;
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data) inserted.push(.../** @type {DbRow[]} */ (/** @type {unknown} */ (data)));
  }

  return inserted;
}

/** @param {Date} date */
function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

/** @param {number} daysFromToday @param {number} hour */
function atUtc(daysFromToday, hour, minute = 0) {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date;
}

/** @param {Date} date @param {number} minutes */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

/** @param {number} value */
function roundMoney(value) {
  return Number(value.toFixed(2));
}

/** @param {number} index */
function appointmentStatus(index) {
  const mod = index % 20;
  if (mod < 12) return "completed";
  if (mod < 15) return "cancelled";
  if (mod < 17) return "confirmed";
  if (mod < 19) return "scheduled";
  return "no_show";
}

/** @param {number} index */
function appointmentOffset(index) {
  if (index < 160) return -120 + Math.floor(index * 120 / 160);
  return 1 + (index - 160);
}

/** @param {number} index @param {number} salonIndex */
function customerName(index, salonIndex) {
  const firstName = FIRST_NAMES[(index + salonIndex) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index * 3 + salonIndex) % LAST_NAMES.length];
  return { firstName, lastName };
}

loadEnvFileIfPresent();

const appEnv = readAppEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const productionSupabaseUrl = process.env.PRODUCTION_SUPABASE_URL;
const confirm = process.env.PRICING_STUDY_CONFIRM;
const batchId = process.env.PRICING_STUDY_BATCH_ID ?? `pricing-${Date.now()}`;

assertSafeBatchId(batchId);

assertSeedEnvironment({ appEnv, allowLocal: process.env.PRICING_STUDY_ALLOW_LOCAL === "true", allowLocalFlag: "PRICING_STUDY_ALLOW_LOCAL", fail });
if (!supabaseUrl || !serviceRoleKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
assertNotProductionUrl({ supabaseUrl, productionSupabaseUrl, fail });
if (confirm !== "seed-pricing-study") {
  fail("Set PRICING_STUDY_CONFIRM=seed-pricing-study to create persistent staging pricing data.");
}

assertSafeTargetOrExit("seed-staging-pricing-study", {
  url: supabaseUrl,
  env: process.env.GLOWBOOK_ENV ?? process.env.APP_ENV ?? process.env.VERCEL_ENV,
  confirmFlag: readConfirmFlag(process.argv),
  productionUrl: process.env.PRODUCTION_SUPABASE_URL,
});
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** @type {StudySummary} */
const summary = {
  batchId,
  password: PASSWORD,
  owners: [],
  tables: {},
  authUsers: 0,
};

console.log(`[seed-pricing-study] Creating batch ${batchId} in staging.`);

for (let salonIndex = 1; salonIndex <= SALON_BLUEPRINTS.length; salonIndex += 1) {
  const salonBlueprint = SALON_BLUEPRINTS[salonIndex - 1];
  const ownerEmail = emailFor(batchId, "owner", salonIndex);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { seed_batch: batchId, seed_kind: "pricing-study" },
  });
  if (authError || !authData.user) throw authError ?? new Error("Owner Auth user was not created.");

  const ownerId = authData.user.id;
  summary.authUsers += 1;
  summary.owners.push({ salon: salonBlueprint.name, email: ownerEmail });

  const salons = await insertRows(
    admin,
    "salons",
    [
      {
        name: salonBlueprint.name,
        email: ownerEmail,
        phone: `60${String(salonIndex).padStart(6, "0")}`,
        address: `Local ${salonIndex}, Ciudad de Panama`,
        timezone: "America/Panama",
        theme: salonBlueprint.theme,
        primary_color: salonBlueprint.primaryColor,
        secondary_color: "#A78BFA",
        bg_style: "neutral",
        card_style: "soft",
        sidebar_style: "clean",
        disabled_features: [],
        payment_methods: PAYMENT_METHODS,
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 15,
        allow_off_hours_bookings: false,
        is_active: true,
      },
    ],
    summary,
    "id"
  );
  const salonId = salons[0].id;

  await insertRows(admin, "profiles", [
    {
      id: ownerId,
      salon_id: salonId,
      full_name: `Owner ${salonBlueprint.name}`,
      is_owner: true,
      is_active: true,
    },
  ], summary);

  await insertRows(
    admin,
    "salon_business_hours",
    Array.from({ length: 7 }, (_, day) => ({
      salon_id: salonId,
      day_of_week: day,
      is_open: day !== 0,
      open_time: day === 0 ? null : "08:00",
      close_time: day === 0 ? null : day <= 2 ? "21:00" : "18:00",
    })),
    summary
  );

  const categories = await insertRows(
    admin,
    "service_categories",
    CATEGORY_BLUEPRINTS.map((category, index) => ({
      salon_id: salonId,
      name: category.name,
      pricing_mode: category.pricing_mode,
      ordering: index + 1,
      is_active: true,
      description: `Servicios de ${category.name.toLowerCase()} para estudio de precios.`,
    })),
    summary,
    "id, name"
  );

  const services = /** @type {ServiceRow[]} */ (await insertRows(
    admin,
    "services",
    CATEGORY_BLUEPRINTS.flatMap((category, categoryIndex) =>
      category.services.map(([name, duration, price]) => ({
        salon_id: salonId,
        category_id: categories[categoryIndex].id,
        name,
        duration_minutes: duration,
        price: roundMoney(price + salonIndex),
        description: `${name} generado para medir uso por plan.`,
        is_active: true,
      }))
    ),
    summary,
    "id, category_id, duration_minutes, price, name"
  ));

  const employees = await insertRows(
    admin,
    "employees",
    EMPLOYEE_NAMES.map(([firstName, lastName, specialty], index) => ({
      salon_id: salonId,
      first_name: firstName,
      last_name: lastName,
      specialty,
      email: emailFor(batchId, "employee", salonIndex, index + 1),
      phone: `62${String(salonIndex).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
      commission_percentage: index % 2 === 0 ? 35 : 40,
      is_active: true,
      hire_date: dateOnly(atUtc(-220 - index * 7, 12)),
    })),
    summary,
    "id"
  );

  await insertRows(
    admin,
    "employee_services",
    employees.flatMap((employee) =>
      services.map((service) => ({
        salon_id: salonId,
        employee_id: employee.id,
        service_id: service.id,
      }))
    ),
    summary
  );

  await insertRows(
    admin,
    "employee_categories",
    employees.flatMap((employee) =>
      categories.map((category) => ({
        salon_id: salonId,
        employee_id: employee.id,
        category_id: category.id,
      }))
    ),
    summary
  );

  await insertRows(
    admin,
    "work_schedules",
    employees.flatMap((employee) =>
      Array.from({ length: 6 }, (_, day) => ({
        salon_id: salonId,
        employee_id: employee.id,
        day_of_week: day + 1,
        start_time: "08:00",
        end_time: day <= 1 ? "21:00" : "18:00",
        is_active: true,
      }))
    ),
    summary
  );

  const customers = await insertRows(
    admin,
    "customers",
    Array.from({ length: 90 }, (_, index) => {
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
    }),
    summary,
    "id"
  );

  const appointments = [];
  const appointmentItems = [];
  for (let index = 0; index < 180; index += 1) {
    const service = services[(index + salonIndex) % services.length];
    const serviceTwo = index % 4 === 0 ? services[(index + salonIndex + 3) % services.length] : null;
    const totalDuration = service.duration_minutes + (serviceTwo?.duration_minutes ?? 0);
    const offset = appointmentOffset(index);
    const hour = 14 + (index % 7);
    const minute = index % 2 === 0 ? 0 : 30;
    const start = atUtc(offset, hour, minute);
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

  await insertRows(admin, "appointments", appointments, summary);
  await insertRows(admin, "appointment_items", appointmentItems, summary);

  const products = /** @type {ProductRow[]} */ (await insertRows(
    admin,
    "inventory_products",
    PRODUCTS.map(([name, category, cost, sale], index) => ({
      salon_id: salonId,
      name,
      category,
      cost_price: roundMoney(cost + salonIndex * 0.4),
      sale_price: roundMoney(sale + salonIndex),
      is_active: true,
      is_retail_enabled: index % 5 !== 4,
      deleted_at: null,
    })),
    summary,
    "id, cost_price, sale_price, name"
  ));

  await insertRows(
    admin,
    "inventory_stock_locations",
    products.flatMap((product, index) =>
      ["retail", "internal", "storage"].map((location, locationIndex) => ({
        salon_id: salonId,
        product_id: product.id,
        location,
        quantity: 18 + ((index + locationIndex + salonIndex) % 14),
        minimum_quantity: location === "storage" ? 6 : 3,
      }))
    ),
    summary
  );

  await insertRows(
    admin,
    "inventory_movements",
    products.flatMap((product, index) =>
      ["retail", "internal", "storage"].map((location, locationIndex) => ({
        salon_id: salonId,
        product_id: product.id,
        location,
        movement_type: "initial",
        quantity_delta: 18 + ((index + locationIndex + salonIndex) % 14),
        quantity_after: 18 + ((index + locationIndex + salonIndex) % 14),
        reference_type: "pricing_seed",
        reference_id: null,
        note: `Stock inicial ${batchId}`,
      }))
    ),
    summary
  );

  const purchases = [];
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
      purchase_date: dateOnly(atUtc(-118 + index * 7, 12)),
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
  await insertRows(admin, "inventory_purchases", purchases, summary);
  await insertRows(admin, "inventory_purchase_items", purchaseItems, summary);

  const retailSales = [];
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
      sale_date: atUtc(-118 + index, 18, 15).toISOString(),
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
  await insertRows(admin, "retail_sales", retailSales, summary);
  await insertRows(admin, "retail_sale_items", retailSaleItems, summary);

  await insertRows(
    admin,
    "expenses",
    Array.from({ length: 32 }, (_, index) => {
      const [category, concept, vendorName] = EXPENSES[index % EXPENSES.length];
      return {
        salon_id: salonId,
        expense_date: dateOnly(atUtc(-118 + index * 4, 12)),
        category,
        custom_category: category === "other" ? concept : null,
        concept,
        amount: roundMoney(35 + (index % 8) * 18 + salonIndex * 5),
        vendor_name: vendorName,
        note: "Gasto operativo para estudio de precios.",
      };
    }),
    summary
  );
}

const totalJsonBytes = Object.values(summary.tables).reduce((total, table) => total + table.jsonBytes, 0);
const estimatedSupabaseBytes = Math.round(totalJsonBytes * 1.65);

console.log("[seed-pricing-study] Done.");
console.log(
  JSON.stringify(
    {
      batchId: summary.batchId,
      password: summary.password,
      owners: summary.owners,
      authUsers: summary.authUsers,
      tables: summary.tables,
      totals: {
        jsonPayloadBytes: totalJsonBytes,
        jsonPayloadMB: Number((totalJsonBytes / 1024 / 1024).toFixed(3)),
        estimatedSupabaseStorageBytes: estimatedSupabaseBytes,
        estimatedSupabaseStorageMB: Number((estimatedSupabaseBytes / 1024 / 1024).toFixed(3)),
      },
      note: "Storage is estimated from inserted JSON payload plus a conservative database-overhead factor. Exact project DB size requires Supabase database metrics or a direct Postgres connection.",
    },
    null,
    2
  )
);
