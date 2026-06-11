import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  BENCHMARK_BATCH_PREFIX,
  BENCHMARK_PASSWORD,
  PAYMENT_METHODS,
  assertBenchmarkBatchId,
  assertStagingEnvironment,
  employeeEmailFor,
  fail,
  getSelectedCohorts,
  ownerEmailFor,
  withSalonOverride,
} from "./pricing-benchmark-shared.mjs";

const SCOPE = "seed-pricing-benchmark-v2";
const INSERT_BATCH_SIZE = Number(process.env.PRICING_BENCHMARK_INSERT_BATCH_SIZE ?? 500);
const MONTHS_OF_HISTORY = 12;
const ALLOW_SYNTHETIC_AUTH_ON_FAILURE =
  process.env.PRICING_BENCHMARK_ALLOW_SYNTHETIC_AUTH_ON_FAILURE === "true";

const SERVICE_CATALOG = [
  ["Cabello", "fixed", [["Corte y secado", 30, 28], ["Color completo", 120, 85], ["Tratamiento hidratante", 60, 45], ["Peinado", 50, 35], ["Keratina", 150, 120], ["Balayage", 180, 160], ["Rizos", 60, 45], ["Lavado especial", 30, 18]]],
  ["Unas", "variable", [["Manicura tradicional", 35, 18], ["Softgel", 75, 35], ["Acrilico", 90, 45], ["Pedicura", 45, 24], ["Gel polish", 40, 22], ["Diseno avanzado", 75, 40], ["Retiro", 30, 12], ["Reconstruccion", 110, 75]]],
  ["Estetica", "fixed", [["Limpieza facial", 70, 55], ["Depilacion de cejas", 30, 20], ["Pestanas lifting", 65, 40], ["Microblading", 120, 95], ["Mascarilla", 45, 28], ["Dermaplaning", 70, 52], ["Hidratacion facial", 60, 42], ["Peeling", 80, 68]]],
  ["Masaje", "fixed", [["Relajante", 50, 30], ["Deportivo", 80, 55], ["Cuerpo completo", 100, 75], ["Drenaje", 65, 48], ["Piedras calientes", 90, 70], ["Cuello y espalda", 45, 32], ["Reflexologia", 55, 38], ["Post operatorio", 100, 90]]],
  ["Maquillaje", "variable", [["Social", 75, 65], ["Novia prueba", 120, 110], ["Evento", 90, 80], ["Pestanas extra", 25, 18], ["Piel glow", 55, 42], ["Asesoria", 60, 50], ["Editorial", 140, 135], ["Retoque", 30, 25]]],
  ["Spa", "fixed", [["Circuito spa", 120, 95], ["Exfoliacion corporal", 60, 52], ["Envoltura", 75, 62], ["Aromaterapia", 45, 35], ["Ritual completo", 180, 150], ["Mascarilla corporal", 50, 38], ["Sauna guiado", 30, 22], ["Pack relax", 150, 125]]],
  ["Barberia", "fixed", [["Corte caballero", 35, 18], ["Barba", 25, 12], ["Perfilado", 20, 10], ["Corte y barba", 55, 28], ["Color barba", 45, 25], ["Cejas", 15, 8], ["Tratamiento barba", 35, 20], ["Fade premium", 50, 32]]],
  ["Bronceado", "fixed", [["Spray tan", 45, 35], ["Cuerpo completo", 60, 48], ["Retoque", 30, 22], ["Preparacion piel", 35, 25], ["Pack mensual", 75, 60], ["Piernas", 25, 18], ["Rostro", 20, 15], ["Premium", 90, 78]]],
];

const FIRST_NAMES = ["Alejandra", "Allan", "Camila", "Daniela", "Elena", "Fabiana", "Gabriel", "Isabella", "Juan", "Karla", "Keily", "Maria", "Nohemy", "Sara", "Sofia", "Valery", "Victoria", "Yamileth", "Laura", "Genesis", "Ana", "Paola", "Nicole", "Andrea"];
const LAST_NAMES = ["Nunez", "Ordonez", "Herrera", "Rodriguez", "Sanchez", "Pitty", "Villanueva", "Martinez", "Perez", "Castillo", "Morales", "Rojas", "Mendez", "Valderrama", "Gomez", "Rivera"];
const PRODUCT_CATEGORIES = ["Cabello", "Unas", "Estetica", "Masaje", "Complementos", "Spa"];
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

function chunk(rows, size = INSERT_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function addPayload(summary, cohortKey, table, rows) {
  summary.totalRows += rows.length;
  summary.cohorts[cohortKey].tables[table] ??= { rows: 0, jsonBytes: 0 };
  summary.cohorts[cohortKey].tables[table].rows += rows.length;
  summary.cohorts[cohortKey].tables[table].jsonBytes += Buffer.byteLength(JSON.stringify(rows), "utf8");
}

async function insertRows(admin, table, rows, summary, cohortKey, select = undefined) {
  if (rows.length === 0) return [];
  addPayload(summary, cohortKey, table, rows);
  const inserted = [];
  for (const group of chunk(rows)) {
    let query = admin.from(table).insert(group);
    if (select) query = query.select(select);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data) inserted.push(...data);
  }
  return inserted;
}

function dateAt(daysFromToday, hour, minute = 0) {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function money(value) {
  return Number(value.toFixed(2));
}

function nameAt(index, salt = 0) {
  return {
    firstName: FIRST_NAMES[(index + salt) % FIRST_NAMES.length],
    lastName: LAST_NAMES[(index * 3 + salt) % LAST_NAMES.length],
  };
}

function appointmentStatus(monthIndex, appointmentIndex, isFuture) {
  if (isFuture) return appointmentIndex % 3 === 0 ? "confirmed" : "scheduled";
  const mod = (monthIndex * 7 + appointmentIndex) % 20;
  if (mod < 13) return "completed";
  if (mod < 17) return "cancelled";
  if (mod < 19) return "no_show";
  return "completed";
}

function daysInMonthWindow(monthIndex, appointmentIndex) {
  const monthStart = -30 * (MONTHS_OF_HISTORY - monthIndex);
  return monthStart + (appointmentIndex % 28);
}

function timeSlot(appointmentIndex, employeesCount) {
  const employeeIndex = appointmentIndex % employeesCount;
  const dailySlot = Math.floor(appointmentIndex / employeesCount) % 24;
  const hour = 8 + Math.floor(dailySlot / 2);
  const minute = dailySlot % 2 === 0 ? 0 : 30;
  return { employeeIndex, hour, minute };
}

function estimateRows(cohorts) {
  const estimates = [];
  for (const cohort of cohorts) {
    const appointmentsPerSalon =
      cohort.appointmentsPerMonth * MONTHS_OF_HISTORY +
      Math.round((cohort.appointmentsPerMonth / 30) * cohort.futureDays);
    const perSalon = {
      salons: 1,
      authUsers: 1 + cohort.collaborators,
      customers: cohort.customers,
      collaborators: cohort.collaborators,
      services: cohort.categories * cohort.servicesPerCategory,
      appointments: appointmentsPerSalon,
      appointment_items: Math.round(appointmentsPerSalon * 1.25),
      retail_sales: cohort.modules.retail ? (cohort.retailSalesPerMonth ?? 0) * MONTHS_OF_HISTORY : 0,
      expenses: cohort.modules.expenses ? (cohort.expensesPerMonth ?? 0) * MONTHS_OF_HISTORY : 0,
      inventory_products: cohort.modules.inventory || cohort.modules.retail ? cohort.products ?? 0 : 0,
      inventory_movements: cohort.modules.inventory ? (cohort.movementsPerMonth ?? 0) * MONTHS_OF_HISTORY : 0,
    };
    estimates.push({
      cohort: cohort.key,
      salons: cohort.salons,
      perSalon,
      cohortTotals: Object.fromEntries(
        Object.entries(perSalon).map(([key, value]) => [key, value * cohort.salons])
      ),
    });
  }
  return estimates;
}

async function createAuthUser(admin, email, fullName) {
  let result;
  try {
    result = await admin.auth.admin.createUser({
      email,
      password: BENCHMARK_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, seed_kind: "pricing-benchmark-v2" },
    });
  } catch (error) {
    const existingUserId = await findAuthUserIdByEmail(admin, email);
    if (existingUserId) return existingUserId;
    if (ALLOW_SYNTHETIC_AUTH_ON_FAILURE) return null;
    throw error;
  }

  if (result.error || !result.data.user) {
    const existingUserId = await findAuthUserIdByEmail(admin, email);
    if (existingUserId) return existingUserId;
    if (ALLOW_SYNTHETIC_AUTH_ON_FAILURE) return null;
    throw result.error ?? new Error(`Auth user was not created for ${email}.`);
  }
  return result.data.user.id;
}

async function findAuthUserIdByEmail(admin, email) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function seedSalon({ admin, cohort, batchId, salonNumber, globalSalonIndex, summary, permissionIds }) {
  const cohortKey = cohort.key;
  const ownerEmail = ownerEmailFor(batchId, cohortKey, salonNumber);
  const ownerId = await createAuthUser(admin, ownerEmail, `${cohort.label} Owner ${salonNumber}`);
  summary.cohorts[cohortKey].authUsers += 1;
  summary.accounts.push({ cohort: cohortKey, salon: `${cohort.label} ${salonNumber}`, email: ownerEmail });

  const disabledFeatures = [
    !cohort.modules.retail ? "retail" : null,
    !cohort.modules.inventory ? "inventory" : null,
    !cohort.modules.expenses ? "expenses" : null,
  ].filter(Boolean);

  const [salon] = await insertRows(
    admin,
    "salons",
    [{
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
    }],
    summary,
    cohortKey,
    "id"
  );
  const salonId = salon.id;

  const roles = await insertRows(
    admin,
    "roles",
    [
      { salon_id: salonId, name: "Owner", is_system: true },
      { salon_id: salonId, name: "Colaborador", is_system: true },
    ],
    summary,
    cohortKey,
    "id, name"
  );
  const ownerRole = roles.find((role) => role.name === "Owner");
  const collaboratorRole = roles.find((role) => role.name === "Colaborador");

  await insertRows(admin, "profiles", [{
    id: ownerId,
    salon_id: salonId,
    full_name: `${cohort.label} Owner ${salonNumber}`,
    role_id: ownerRole.id,
    is_owner: true,
    is_active: true,
  }], summary, cohortKey);

  await insertRows(
    admin,
    "role_permissions",
    [
      ...permissionIds.map((permission) => ({
        salon_id: salonId,
        role_id: ownerRole.id,
        permission_id: permission.id,
      })),
      ...permissionIds
        .filter((permission) => permission.key === "appointments.view")
        .map((permission) => ({
          salon_id: salonId,
          role_id: collaboratorRole.id,
          permission_id: permission.id,
        })),
    ],
    summary,
    cohortKey
  );

  await insertRows(admin, "salon_business_hours", Array.from({ length: 7 }, (_, day) => ({
    salon_id: salonId,
    day_of_week: day,
    is_open: day !== 0,
    open_time: day === 0 ? null : "08:00",
    close_time: day === 0 ? null : "20:00",
  })), summary, cohortKey);

  const templates = await insertRows(admin, "notification_templates", [
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
  ], summary, cohortKey, "id, channel");

  const selectedCatalog = SERVICE_CATALOG.slice(0, cohort.categories);
  const categories = await insertRows(admin, "service_categories", selectedCatalog.map(([name, pricing_mode], index) => ({
    salon_id: salonId,
    name,
    pricing_mode,
    ordering: index + 1,
    is_active: true,
    description: `Categoria ${name} para benchmark.`,
  })), summary, cohortKey, "id, name");

  const services = await insertRows(admin, "services", selectedCatalog.flatMap((category, categoryIndex) =>
    category[2].slice(0, cohort.servicesPerCategory).map(([name, duration, price]) => ({
      salon_id: salonId,
      category_id: categories[categoryIndex].id,
      name,
      duration_minutes: duration,
      price: money(price + cohort.key.charCodeAt(0) - 64),
      description: `${name} para benchmark de pricing.`,
      is_active: true,
    }))
  ), summary, cohortKey, "id, category_id, duration_minutes, price, name");

  const employeeRows = [];
  const profileRows = [];
  for (let index = 1; index <= cohort.collaborators; index += 1) {
    const { firstName, lastName } = nameAt(index, globalSalonIndex);
    const email = employeeEmailFor(batchId, cohortKey, salonNumber, index);
    const profileId = await createAuthUser(admin, email, `${firstName} ${lastName}`);
    summary.cohorts[cohortKey].authUsers += 1;
    employeeRows.push({
      salon_id: salonId,
      first_name: firstName,
      last_name: lastName,
      specialty: categories[(index - 1) % categories.length].name,
      email,
      phone: `62${String(globalSalonIndex).padStart(3, "0")}${String(index).padStart(4, "0")}`,
      profile_id: profileId,
      commission_percentage: 35 + (index % 3) * 5,
      is_active: true,
      hire_date: dateOnly(dateAt(-260 - index, 12)),
    });
    profileRows.push({
      id: profileId,
      salon_id: salonId,
      full_name: `${firstName} ${lastName}`,
      role_id: collaboratorRole.id,
      is_owner: false,
      is_active: true,
    });
  }
  await insertRows(admin, "profiles", profileRows, summary, cohortKey);
  const employees = await insertRows(admin, "employees", employeeRows, summary, cohortKey, "id");

  await insertRows(admin, "employee_services", employees.flatMap((employee) =>
    services.map((service) => ({ salon_id: salonId, employee_id: employee.id, service_id: service.id }))
  ), summary, cohortKey);
  await insertRows(admin, "employee_categories", employees.flatMap((employee) =>
    categories.map((category) => ({ salon_id: salonId, employee_id: employee.id, category_id: category.id }))
  ), summary, cohortKey);
  await insertRows(admin, "work_schedules", employees.flatMap((employee) =>
    Array.from({ length: 6 }, (_, index) => ({
      salon_id: salonId,
      employee_id: employee.id,
      day_of_week: index + 1,
      start_time: "08:00",
      end_time: "20:00",
      is_active: true,
    }))
  ), summary, cohortKey);

  const customers = await insertRows(admin, "customers", Array.from({ length: cohort.customers }, (_, index) => {
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
  }), summary, cohortKey, "id");

  const appointments = [];
  const appointmentItems = [];
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

  await insertRows(admin, "appointments", appointments, summary, cohortKey);
  await insertRows(admin, "appointment_items", appointmentItems, summary, cohortKey);
  await insertRows(admin, "appointment_reminder_log", reminderLogs, summary, cohortKey);

  if (cohort.modules.retail || cohort.modules.inventory) {
    const products = await insertRows(admin, "inventory_products", Array.from({ length: cohort.products ?? 0 }, (_, index) => {
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
    }), summary, cohortKey, "id, cost_price, sale_price");

    await insertRows(admin, "inventory_stock_locations", products.flatMap((product, index) =>
      ["retail", "internal", "storage"].map((location, locationIndex) => ({
        salon_id: salonId,
        product_id: product.id,
        location,
        quantity: 10 + ((index + locationIndex) % 30),
        minimum_quantity: location === "storage" ? 8 : 3,
      }))
    ), summary, cohortKey);

    const movementCount = cohort.modules.inventory ? (cohort.movementsPerMonth ?? 0) * MONTHS_OF_HISTORY : products.length * 3;
    await insertRows(admin, "inventory_movements", Array.from({ length: movementCount }, (_, index) => {
      const product = products[index % products.length];
      return {
        salon_id: salonId,
        product_id: product.id,
        location: ["retail", "internal", "storage"][index % 3],
        movement_type: index < products.length * 3 ? "initial" : ["purchase", "retail_sale", "internal_use", "adjustment"][index % 4],
        quantity_delta: index % 4 === 2 ? -1 : 4 + (index % 7),
        quantity_after: 15 + (index % 25),
        reference_type: "pricing_benchmark",
        reference_id: null,
        note: `Benchmark ${batchId}`,
        created_at: dateAt(-360 + (index % 360), 12).toISOString(),
      };
    }), summary, cohortKey);

    const purchases = [];
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
    await insertRows(admin, "inventory_purchases", purchases, summary, cohortKey);
    await insertRows(admin, "inventory_purchase_items", purchaseItems, summary, cohortKey);

    if (cohort.modules.retail) {
      const sales = [];
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
      await insertRows(admin, "retail_sales", sales, summary, cohortKey);
      await insertRows(admin, "retail_sale_items", saleItems, summary, cohortKey);
    }
  }

  if (cohort.modules.expenses) {
    await insertRows(admin, "expenses", Array.from({ length: (cohort.expensesPerMonth ?? 0) * MONTHS_OF_HISTORY }, (_, index) => {
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
    }), summary, cohortKey);
  }
}

assertStagingEnvironment(SCOPE);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) fail(SCOPE, "Set SUPABASE_SERVICE_ROLE_KEY.");

const batchId = process.env.PRICING_BENCHMARK_BATCH_ID ?? `${BENCHMARK_BATCH_PREFIX}-${Date.now()}`;
assertBenchmarkBatchId(SCOPE, batchId);

const cohorts = getSelectedCohorts(SCOPE).map(withSalonOverride);
const dryRun = process.env.PRICING_BENCHMARK_DRY_RUN === "true";
const confirm = process.env.PRICING_BENCHMARK_CONFIRM;

if (dryRun) {
  console.log(JSON.stringify({ batchId, dryRun: true, cohorts: estimateRows(cohorts) }, null, 2));
  process.exit(0);
}

if (confirm !== "seed-pricing-benchmark-v2") {
  fail(SCOPE, "Set PRICING_BENCHMARK_CONFIRM=seed-pricing-benchmark-v2 to create persistent staging benchmark data.");
}

if (cohorts.some((cohort) => cohort.key === "E") && process.env.PRICING_BENCHMARK_HEAVY_CONFIRM !== "include-stress-cohort") {
  fail(SCOPE, "Cohort E is heavy. Set PRICING_BENCHMARK_HEAVY_CONFIRM=include-stress-cohort or exclude E with PRICING_BENCHMARK_COHORTS.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: permissions, error: permissionsError } = await admin.from("permissions").select("id, key");
if (permissionsError) throw permissionsError;

const summary = {
  batchId,
  password: BENCHMARK_PASSWORD,
  accounts: [],
  totalRows: 0,
  cohorts: Object.fromEntries(
    cohorts.map((cohort) => [cohort.key, { label: cohort.label, salons: 0, authUsers: 0, tables: {} }])
  ),
};

let globalSalonIndex = 0;
for (const cohort of cohorts) {
  for (let salonNumber = 1; salonNumber <= cohort.salons; salonNumber += 1) {
    globalSalonIndex += 1;
    console.log(`[${SCOPE}] Seeding cohort ${cohort.key} salon ${salonNumber}/${cohort.salons}`);
    await seedSalon({
      admin,
      cohort,
      batchId,
      salonNumber,
      globalSalonIndex,
      summary,
      permissionIds: permissions,
    });
    summary.cohorts[cohort.key].salons += 1;
  }
}

console.log(JSON.stringify(summary, null, 2));
