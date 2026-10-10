import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
} from "@/test/supabase-integration-fixtures";
import type { Database } from "@/types/database.types";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  roundCurrency,
} from "../../domain/pricing";
import { completeAppointmentRpc, type CompleteAppointmentRpcInput } from "./complete-appointment";

// La prueba usa el adaptador real de completar cita; solo sustituye el cliente de servidor
// (cookies) por el cliente de integración ya autenticado como owner del salón de prueba.
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

type Db = SupabaseClient<Database>;

/** Servicio base de la categoría fija del fixture (precio 15) o de una categoría de precio variable (precio 10). */
type ServiceKind = "fijo" | "variable";

/** Un item de la cita. Si `charge` no existe, el item no se envía a la RPC y conserva su precio sin descuento. */
interface PricingItemSpec {
  kind: ServiceKind;
  charge?: { price: number; discountPercentage: number };
}

interface PricingCase {
  name: string;
  items: PricingItemSpec[];
  /** Totales esperados calculados a mano: se comprueban antes que la comparación para no dar por buena una referencia errónea. */
  expected: { subtotal: number; discount: number; total: number };
}

/**
 * Casos cubiertos. Los cargos de precio variable simulan extras sobre el precio base;
 * los de precio fijo deben enviarse con su precio de catálogo (la RPC lo rechaza si cambia).
 */
const CASES: PricingCase[] = [
  {
    name: "sin descuento en servicio fijo",
    items: [{ kind: "fijo", charge: { price: 15, discountPercentage: 0 } }],
    expected: { subtotal: 15, discount: 0, total: 15 },
  },
  {
    name: "descuento porcentual del 10% en servicio fijo",
    items: [{ kind: "fijo", charge: { price: 15, discountPercentage: 10 } }],
    expected: { subtotal: 15, discount: 1.5, total: 13.5 },
  },
  {
    name: "cargo extra en item de precio variable sin descuento",
    items: [{ kind: "variable", charge: { price: 22.5, discountPercentage: 0 } }],
    expected: { subtotal: 22.5, discount: 0, total: 22.5 },
  },
  {
    name: "redondeo medio centimo: 10% sobre 0.15 da 0.02 de descuento",
    items: [{ kind: "variable", charge: { price: 0.15, discountPercentage: 10 } }],
    expected: { subtotal: 0.15, discount: 0.02, total: 0.13 },
  },
  {
    name: "redondeo de 33% sobre 33.33",
    items: [{ kind: "variable", charge: { price: 33.33, discountPercentage: 33 } }],
    expected: { subtotal: 33.33, discount: 11, total: 22.33 },
  },
  {
    name: "varios items con descuentos y cargos distintos",
    items: [
      { kind: "fijo", charge: { price: 15, discountPercentage: 10 } },
      { kind: "variable", charge: { price: 22.5, discountPercentage: 12.5 } },
      { kind: "variable", charge: { price: 0.35, discountPercentage: 50 } },
    ],
    expected: { subtotal: 37.85, discount: 4.49, total: 33.36 },
  },
  {
    name: "item sin cobro enviado conserva precio y pierde descuento",
    items: [{ kind: "fijo", charge: { price: 15, discountPercentage: 20 } }, { kind: "variable" }],
    expected: { subtotal: 25, discount: 3, total: 22 },
  },
  {
    name: "descuento del 100% deja el total en cero",
    items: [{ kind: "variable", charge: { price: 50, discountPercentage: 100 } }],
    expected: { subtotal: 50, discount: 50, total: 0 },
  },
  {
    name: "descuentos por item redondeados antes de sumar (no sobre el total)",
    items: [
      { kind: "variable", charge: { price: 0.05, discountPercentage: 50 } },
      { kind: "variable", charge: { price: 0.05, discountPercentage: 50 } },
    ],
    expected: { subtotal: 0.1, discount: 0.06, total: 0.04 },
  },
];

const createdAppointmentIds: string[] = [];

interface ItemRow {
  id: string;
  ordering: number;
  price: number;
  discount_amount: number;
}

interface Reference {
  subtotal: number;
  discount: number;
  total: number;
  items: { price: number; discount: number }[];
}

/**
 * Referencia de la app: misma lógica que la vista previa de complete-appointment.tsx.
 * Cada item redondea su descuento; el total se calcula sobre el subtotal y el descuento sumados.
 */
function referenceFor(items: PricingItemSpec[], rows: ItemRow[]): Reference {
  const perItem = items.map((spec, index) => {
    const row = rows[index];
    if (!row) throw new Error(`Falta el item ${index + 1} en la cita creada.`);
    const charge = spec.charge;
    const price = roundCurrency(charge ? charge.price : row.price);
    const discountPercentage = charge ? charge.discountPercentage : 0;
    return { price, discount: calculateDiscountAmount(price, discountPercentage) };
  });
  const subtotal = roundCurrency(perItem.reduce((sum, item) => sum + item.price, 0));
  const discount = roundCurrency(perItem.reduce((sum, item) => sum + item.discount, 0));
  return {
    subtotal,
    discount,
    total: calculateFinalChargedTotal(subtotal, discount),
    items: perItem,
  };
}

function startOfBusinessDay(dayOffset: number): Date {
  // Salón en America/Panama (UTC-5 sin horario de verano): 09:00 local = 14:00 UTC.
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 14 + dayOffset, 14, 0, 0)
  );
}

describe(
  "paridad de precios: pricing.ts frente a complete_appointment (requires Supabase integration env vars)",
  () => {
    let admin: Db;
    let user: Db;
    let owner: SalonOwnerFixture;
    let variableServiceId: string;

    beforeAll(async () => {
      const integrationEnv = getSupabaseIntegrationEnv();
      admin = createIntegrationAdminClient(integrationEnv);
      user = createIntegrationUserClient(integrationEnv);

      owner = await createSalonOwnerFixture(admin, "PARIDAD");

      const { error: signInError } = await user.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      });
      if (signInError) throw signInError;

      vi.mocked(createSupabaseServerClient).mockResolvedValue(user as never);

      const { data: category, error: categoryError } = await admin
        .from("service_categories")
        .insert({
          salon_id: owner.salonId,
          name: "PARIDAD Categoria variable",
          is_active: true,
          pricing_mode: "variable",
        })
        .select("id")
        .single();
      if (categoryError) throw categoryError;

      const { data: service, error: serviceError } = await admin
        .from("services")
        .insert({
          salon_id: owner.salonId,
          category_id: category.id,
          name: "PARIDAD Servicio variable",
          duration_minutes: 30,
          price: 10,
          is_active: true,
        })
        .select("id")
        .single();
      if (serviceError) throw serviceError;
      variableServiceId = service.id;

      const [{ error: assignServiceError }, { error: assignCategoryError }] = await Promise.all([
        admin.from("employee_services").insert({
          salon_id: owner.salonId,
          employee_id: owner.employeeId,
          service_id: service.id,
        }),
        admin.from("employee_categories").insert({
          salon_id: owner.salonId,
          employee_id: owner.employeeId,
          category_id: category.id,
        }),
      ]);
      if (assignServiceError) throw assignServiceError;
      if (assignCategoryError) throw assignCategoryError;
    }, 60_000);

    afterAll(async () => {
      if (createdAppointmentIds.length) {
        await admin.from("appointments").delete().in("id", createdAppointmentIds);
        createdAppointmentIds.length = 0;
      }
      await cleanupSalonOwnerFixture(admin, owner);
    }, 60_000);

    async function createAppointment(items: PricingItemSpec[], dayOffset: number): Promise<string> {
      const base = startOfBusinessDay(dayOffset);
      const payloadItems = items.map((spec, index) => {
        const start = new Date(base.getTime() + index * 30 * 60_000);
        return {
          service_id: spec.kind === "fijo" ? owner.serviceId : variableServiceId,
          employee_id: owner.employeeId,
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + 30 * 60_000).toISOString(),
          ordering: index + 1,
        };
      });
      const { data, error } = await user.rpc("create_appointment", {
        payload: { customer_id: owner.customerId, notes: "PARIDAD precios", items: payloadItems },
      });
      if (error) throw error;
      const appointmentId = data as string;
      createdAppointmentIds.push(appointmentId);
      return appointmentId;
    }

    async function readItems(appointmentId: string): Promise<ItemRow[]> {
      const { data, error } = await admin
        .from("appointment_items")
        .select("id, ordering, price, discount_amount")
        .eq("appointment_id", appointmentId)
        .order("ordering");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        ordering: row.ordering,
        price: Number(row.price),
        discount_amount: Number(row.discount_amount),
      }));
    }

    it.each(CASES.map((testCase, index) => [testCase.name, testCase, index] as const))(
      "%s",
      async (_name, testCase, index) => {
        // Comprobación de la referencia: los totales a mano deben coincidir con pricing.ts.
        const reference = referenceFor(
          testCase.items,
          testCase.items.map((spec) => ({
            id: "",
            ordering: 0,
            price: spec.kind === "fijo" ? 15 : 10,
            discount_amount: 0,
          }))
        );
        expect(reference.subtotal).toBe(testCase.expected.subtotal);
        expect(reference.discount).toBe(testCase.expected.discount);
        expect(reference.total).toBe(testCase.expected.total);

        const appointmentId = await createAppointment(testCase.items, index);
        const rows = await readItems(appointmentId);
        expect(rows).toHaveLength(testCase.items.length);

        const actual = referenceFor(testCase.items, rows);
        const itemCharges: CompleteAppointmentRpcInput["itemCharges"] = [];
        testCase.items.forEach((spec, position) => {
          const row = rows[position];
          if (!row || !spec.charge) return;
          itemCharges.push({
            id: row.id,
            price: spec.charge.price,
            discountPercentage: spec.charge.discountPercentage,
          });
        });

        const result = await completeAppointmentRpc({
          appointmentId,
          paymentMethod: "cash",
          itemCharges,
        });

        // La RPC devuelve los mismos totales que la vista previa de la app.
        expect(result.subtotal).toBe(actual.subtotal);
        expect(result.discount_amount).toBe(actual.discount);
        expect(result.total_price).toBe(actual.total);
        expect(result.total_price).toBe(testCase.expected.total);

        // Y la base los guarda en la cabecera y en cada item.
        const { data: header, error: headerError } = await admin
          .from("appointments")
          .select("status, total_price, discount_amount")
          .eq("id", appointmentId)
          .single();
        if (headerError) throw headerError;
        expect(header.status).toBe("completed");
        expect(Number(header.total_price)).toBe(actual.total);
        expect(Number(header.discount_amount)).toBe(actual.discount);

        const storedItems = await readItems(appointmentId);
        storedItems.forEach((stored, position) => {
          expect(stored.price, `precio del item ${position + 1}`).toBe(actual.items[position]?.price);
          expect(stored.discount_amount, `descuento del item ${position + 1}`).toBe(
            actual.items[position]?.discount
          );
        });
      },
      60_000
    );
  }
);
