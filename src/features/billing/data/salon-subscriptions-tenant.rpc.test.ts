import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "@/test/supabase-integration-fixtures";
import { PLAN_COLUMNS } from "./commercial-plans.rows";
import { ASSIGNMENT_TENANT_COLUMNS, OVERRIDE_TENANT_COLUMNS } from "./salon-subscriptions.rows";

// Billing de inquilino contra la BD local real (RLS, grants de columna y RPC de la migración 073).
// Un usuario de un salón con un plan ARCHIVADO asignado debe:
//   - leer su plan y su asignación (sin notas) y los overrides de sus reglas;
//   - NO leer motivo, precio especial ni regalo (error 42501 al pedir esas columnas);
//   - contar su uso con count_salon_usage, pero no el de otro salón;
//   - crear alertas de plan para su salón con record_plan_alert.

const METRIC_KEY = "employees.active";
const MODULE_KEY = "employees";
const env = getSupabaseIntegrationEnv();
const admin: TestSupabaseClient = createIntegrationAdminClient(env);

let owner: SalonOwnerFixture | null = null;
let otherOwner: SalonOwnerFixture | null = null;
let planId = "";
let overrideId = "";
let alertIds: string[] = [];

async function signedInClient(fixture: SalonOwnerFixture): Promise<TestSupabaseClient> {
  const client = createIntegrationUserClient(env);
  const { error } = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  if (error) throw error;
  return client;
}

describe("billing de inquilino con RLS (integración)", () => {
  beforeAll(async () => {
    owner = await createSalonOwnerFixture(admin, "RPC Billing");
    otherOwner = await createSalonOwnerFixture(admin, "RPC Billing Ajeno");

    const { data: plan, error: planError } = await admin
      .from("commercial_plans")
      .insert({
        code: `rpc-archivado-${randomUUID().slice(0, 8)}`,
        name: "Plan archivado RPC",
        status: "archived",
        is_public: false,
      })
      .select("id")
      .single();
    if (planError) throw planError;
    planId = plan.id;

    const { error: assignmentError } = await admin.from("salon_plan_assignments").upsert(
      {
        salon_id: owner.salonId,
        plan_id: planId,
        status: "active",
        notes: "nota interna RPC",
      },
      { onConflict: "salon_id" }
    );
    if (assignmentError) throw assignmentError;

    const { data: override, error: overrideError } = await admin
      .from("salon_plan_overrides")
      .insert({
        salon_id: owner.salonId,
        metric_key: METRIC_KEY,
        max_delta: 1,
        reason: "motivo interno RPC",
        is_gift: false,
        price_override: 0,
        status: "active",
        quantity: 1,
      })
      .select("id")
      .single();
    if (overrideError) throw overrideError;
    overrideId = override.id;
  }, 60_000);

  afterAll(async () => {
    if (alertIds.length > 0) await admin.from("salon_plan_alerts").delete().in("id", alertIds);
    if (overrideId) await admin.from("salon_plan_overrides").delete().eq("id", overrideId);
    if (owner) await admin.from("salon_plan_assignments").delete().eq("salon_id", owner.salonId);
    if (planId) await admin.from("commercial_plans").delete().eq("id", planId);
    await cleanupSalonOwnerFixture(admin, owner);
    await cleanupSalonOwnerFixture(admin, otherOwner);
  }, 60_000);

  it("el salón lee su plan archivado asignado con su sesión", async () => {
    const client = await signedInClient(requireFixture(owner));

    const { data, error } = await client.from("commercial_plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(planId);
  });

  it("el salón lee su asignación sin notas", async () => {
    const owned = requireFixture(owner);
    const client = await signedInClient(owned);

    const { data, error } = await client
      .from("salon_plan_assignments")
      .select(ASSIGNMENT_TENANT_COLUMNS)
      .eq("salon_id", owned.salonId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.plan_id).toBe(planId);
  });

  it("no puede leer las notas internas de la asignación (42501)", async () => {
    const client = await signedInClient(requireFixture(owner));

    const { error } = await client.from("salon_plan_assignments").select("notes");

    expect(error?.code).toBe("42501");
  });

  it("lee las reglas de sus overrides pero no motivo, precio especial ni regalo", async () => {
    const owned = requireFixture(owner);
    const client = await signedInClient(owned);

    const { data, error } = await client
      .from("salon_plan_overrides")
      .select(OVERRIDE_TENANT_COLUMNS)
      .eq("salon_id", owned.salonId);
    expect(error).toBeNull();
    expect(data?.map((row) => row.id)).toEqual([overrideId]);

    for (const denied of ["reason", "price_override", "is_gift"] as const) {
      const denial = await client.from("salon_plan_overrides").select(denied);
      expect(denial.error?.code, denied).toBe("42501");
    }
  });

  it("no ve las asignaciones de otro salón (RLS)", async () => {
    const client = await signedInClient(requireFixture(otherOwner));

    const { data, error } = await client
      .from("salon_plan_assignments")
      .select(ASSIGNMENT_TENANT_COLUMNS)
      .eq("salon_id", requireFixture(owner).salonId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cuenta su uso con count_salon_usage y no el de otro salón", async () => {
    const owned = requireFixture(owner);
    const client = await signedInClient(owned);
    const counters = [{ key: METRIC_KEY, counter: "employees_active", from: null, to: null }];

    const own = await client.rpc("count_salon_usage", { p_salon_id: owned.salonId, p_counters: counters });
    expect(own.error).toBeNull();
    expect(typeof (own.data as Record<string, unknown>)[METRIC_KEY]).toBe("number");

    const foreign = await client.rpc("count_salon_usage", {
      p_salon_id: requireFixture(otherOwner).salonId,
      p_counters: counters,
    });
    expect(foreign.error?.code).toBe("42501");
  });

  it("record_plan_alert crea la alerta en el salón de la sesión", async () => {
    const owned = requireFixture(owner);
    const client = await signedInClient(owned);

    const { data: alertId, error } = await client.rpc("record_plan_alert", {
      p_plan_id: planId,
      p_metric_key: METRIC_KEY,
      p_module_key: MODULE_KEY,
      p_severity: "warning",
      p_message: "Aviso de prueba RPC",
    });
    expect(error).toBeNull();
    if (!alertId) throw new Error("record_plan_alert no devolvió id");
    alertIds = [...alertIds, alertId];

    const { data: stored, error: readError } = await admin
      .from("salon_plan_alerts")
      .select("salon_id, metric_key")
      .eq("id", alertId)
      .single();
    expect(readError).toBeNull();
    expect(stored).toEqual({ salon_id: owned.salonId, metric_key: METRIC_KEY });
  });
});

function requireFixture(fixture: SalonOwnerFixture | null): SalonOwnerFixture {
  if (!fixture) throw new Error("La fixture de salón no se creó en beforeAll");
  return fixture;
}
