// Pruebas de los constructores de filas del benchmark de precios v2 (salón, personal, catálogo, clientas).
import { test } from "node:test";
import assert from "node:assert/strict";
import { employeeEmailFor } from "../pricing-benchmark-shared.mjs";
import { SERVICE_CATALOG } from "../seed-pricing-benchmark-catalog.mjs";
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
    customers: 45,
    appointmentsPerMonth: 30,
    futureDays: 30,
    modules: { retail: true, inventory: true, expenses: true, reminders: true },
    ...fields,
  };
  return /** @type {CohortConfig} */ (/** @type {unknown} */ (base));
}

test("buildSalonRow desactiva los módulos que la cohorte no incluye", () => {
  const row = buildSalonRow({
    cohort: cohortOf({ modules: { retail: false, inventory: true, expenses: false, reminders: false } }),
    cohortKey: "A",
    salonNumber: 2,
    globalSalonIndex: 7,
    ownerEmail: "owner@example.com",
  });
  assert.deepEqual(row.disabled_features, ["retail", "expenses"]);
  assert.equal(row.name, "Benchmark A - Cohorte A 2");
  assert.equal(row.phone, "60000007");
  assert.equal(row.theme, "violet");
  assert.equal(row.primary_color, "#7C3AED");
});

test("buildSalonRow usa el tema indigo para la cohorte E y el color azul para la C", () => {
  const stress = buildSalonRow({ cohort: cohortOf({ key: "E" }), cohortKey: "E", salonNumber: 1, globalSalonIndex: 1, ownerEmail: "e@example.com" });
  const cobalt = buildSalonRow({ cohort: cohortOf({ key: "C" }), cohortKey: "C", salonNumber: 1, globalSalonIndex: 1, ownerEmail: "c@example.com" });
  assert.equal(stress.theme, "indigo");
  assert.equal(cobalt.primary_color, "#2563EB");
});

test("buildRoleRows crea los roles Owner y Colaborador del sistema", () => {
  assert.deepEqual(
    buildRoleRows("salon-1").map((role) => role.name),
    ["Owner", "Colaborador"]
  );
});

test("buildRolePermissionRows concede todo al Owner y solo appointments.view al Colaborador", () => {
  const rows = buildRolePermissionRows({
    salonId: "salon-1",
    ownerRoleId: "owner-role",
    collaboratorRoleId: "collab-role",
    permissionIds: [
      { id: "p1", key: "appointments.view" },
      { id: "p2", key: "reports.view" },
    ],
  });
  assert.equal(rows.filter((row) => row.role_id === "owner-role").length, 2);
  assert.deepEqual(
    rows.filter((row) => row.role_id === "collab-role").map((row) => row.permission_id),
    ["p1"]
  );
});

test("buildBusinessHourRows deja el domingo cerrado y el resto de 08:00 a 20:00", () => {
  const rows = buildBusinessHourRows("salon-1");
  assert.equal(rows.length, 7);
  assert.equal(rows[0].is_open, false);
  assert.equal(rows[0].open_time, null);
  assert.equal(rows[1].open_time, "08:00");
  assert.equal(rows[1].close_time, "20:00");
});

test("buildTemplateRows crea una plantilla de WhatsApp y otra de correo", () => {
  assert.deepEqual(
    buildTemplateRows("salon-1").map((template) => template.channel),
    ["whatsapp", "email"]
  );
});

test("buildCategoryRows toma las primeras categorías del catálogo con orden secuencial", () => {
  const rows = buildCategoryRows("salon-1", cohortOf({ categories: 2 }));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, SERVICE_CATALOG[0][0]);
  assert.deepEqual(rows.map((row) => row.ordering), [1, 2]);
});

test("buildServiceRows desplaza el precio por la letra de la cohorte (C suma 3)", () => {
  const categories = [{ id: "cat-1" }, { id: "cat-2" }];
  const rows = buildServiceRows("salon-1", cohortOf({ key: "C", categories: 2, servicesPerCategory: 1 }), categories);
  const [firstName, firstDuration, firstPrice] = SERVICE_CATALOG[0][2][0];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, firstName);
  assert.equal(rows[0].duration_minutes, firstDuration);
  assert.equal(rows[0].price, Number((firstPrice + 3).toFixed(2)));
  assert.equal(rows[1].category_id, "cat-2");
});

test("buildStaffPlan numera las colaboradoras desde 1 con correos deterministas", () => {
  const plan = buildStaffPlan(cohortOf({ collaborators: 2 }), { batchId: "pricing-benchmark-v2-x", cohortKey: "A", salonNumber: 1, globalSalonIndex: 3 });
  assert.deepEqual(plan.map((person) => person.index), [1, 2]);
  assert.equal(plan[0].email, employeeEmailFor("pricing-benchmark-v2-x", "A", 1, 1));
  assert.equal(plan[1].fullName, `${plan[1].firstName} ${plan[1].lastName}`);
});

test("buildEmployeeRows asigna especialidad, comisión y perfil de Auth por posición", () => {
  const staff = buildStaffPlan(cohortOf({ collaborators: 2 }), { batchId: "b", cohortKey: "A", salonNumber: 1, globalSalonIndex: 7 });
  const rows = buildEmployeeRows({
    salonId: "salon-1",
    categories: [{ name: "Cabello" }, { name: "Unas" }],
    globalSalonIndex: 7,
    staff,
    profileIds: ["user-1", null],
  });
  assert.equal(rows[0].specialty, "Cabello");
  assert.equal(rows[1].specialty, "Unas");
  assert.equal(rows[0].commission_percentage, 40);
  assert.equal(rows[1].commission_percentage, 45);
  assert.equal(rows[0].profile_id, "user-1");
  assert.equal(rows[1].profile_id, null);
  assert.equal(rows[1].phone, "620070002");
});

test("buildCollaboratorProfileRows crea perfiles no propietarios con el rol Colaborador", () => {
  const staff = buildStaffPlan(cohortOf({ collaborators: 1 }), { batchId: "b", cohortKey: "A", salonNumber: 1, globalSalonIndex: 1 });
  const [profile] = buildCollaboratorProfileRows({ salonId: "salon-1", collaboratorRoleId: "collab-role", staff, profileIds: ["user-9"] });
  assert.equal(profile.id, "user-9");
  assert.equal(profile.is_owner, false);
  assert.equal(profile.role_id, "collab-role");
});

test("buildCustomerRows genera las clientas de la cohorte; la primera es frecuente e inactiva", () => {
  const rows = buildCustomerRows({
    salonId: "salon-1",
    cohort: cohortOf({ customers: 45 }),
    cohortKey: "A",
    batchId: "b",
    salonNumber: 1,
    globalSalonIndex: 2,
  });
  assert.equal(rows.length, 45);
  assert.equal(rows[0].is_active, false);
  assert.equal(rows[1].is_active, true);
  assert.equal(rows[0].notes, "Cliente frecuente benchmark.");
  assert.equal(rows[1].notes, "");
});

test("buildEmployeeLinkRows enlaza cada empleada con todos los servicios y categorías y da seis días laborales", () => {
  const links = buildEmployeeLinkRows({
    salonId: "salon-1",
    employees: [{ id: "e1" }, { id: "e2" }],
    services: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
    categories: [{ id: "c1" }, { id: "c2" }],
  });
  assert.equal(links.employeeServices.length, 6);
  assert.equal(links.employeeCategories.length, 4);
  assert.equal(links.workSchedules.length, 12);
  assert.deepEqual(links.workSchedules.slice(0, 6).map((row) => row.day_of_week), [1, 2, 3, 4, 5, 6]);
});
