import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createScheduledAppointmentFixture,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
} from "@/test/supabase-integration-fixtures";
import type { Database } from "@/types/database.types";

// Regresión: cancelar una cita de un cliente temporal y descartarlo debe funcionar.
// Antes, borrar la fila de customers fallaba con 23503 porque la cita cancelada seguía
// referenciándola (fk_appointments_customer_same_salon, on delete restrict).

const integrationEnv = getSupabaseIntegrationEnv();

type Db = SupabaseClient<Database>;

describe("discard_temporary_customer RPC (requires Supabase integration env vars)", () => {
  let admin: Db;
  let user: Db;
  let ownerFixture: SalonOwnerFixture;

  beforeAll(async () => {
    admin = createIntegrationAdminClient(integrationEnv);
    user = createIntegrationUserClient(integrationEnv);
    ownerFixture = await createSalonOwnerFixture(admin, "DISCARD");

    const { error } = await user.auth.signInWithPassword({
      email: ownerFixture.email,
      password: ownerFixture.password,
    });
    if (error) throw error;

    // El cliente de la fixture pasa a ser temporal, como uno creado desde el asistente de citas.
    const { error: updateError } = await admin
      .from("customers")
      .update({ is_temporary: true })
      .eq("id", ownerFixture.customerId);
    if (updateError) throw updateError;
  }, 60_000);

  afterAll(async () => {
    await cleanupSalonOwnerFixture(admin, ownerFixture);
  }, 30_000);

  it("descarta un cliente temporal cuya única cita está cancelada", async () => {
    const appointment = await createScheduledAppointmentFixture(admin, ownerFixture, {
      daysAhead: 30,
      hour: 15,
      notes: "DISCARD cancelada",
    });

    const { error: cancelError } = await user.rpc("cancel_appointment", {
      payload: { appointment_id: appointment.appointmentId },
    });
    expect(cancelError).toBeNull();

    const { error: discardError } = await user.rpc("discard_temporary_customer", {
      p_customer_id: ownerFixture.customerId,
    });
    expect(discardError).toBeNull();

    const { data: remaining, error: remainingError } = await admin
      .from("customers")
      .select("id")
      .eq("id", ownerFixture.customerId);
    if (remainingError) throw remainingError;
    expect(remaining).toEqual([]);
  }, 30_000);
});
