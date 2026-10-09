import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import {
  createAppointmentsSupabaseDouble,
  installSupabaseDouble,
  type AppointmentsSupabaseDouble,
} from "@/test/appointments-feature-supabase";
import { findAppointmentById, findAppointmentsBySalon } from "./appointments.repo";

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createSupabaseServerClient);

const salonId = "00000000-0000-4000-8000-0000000000j1";
const appointmentId = "00000000-0000-4000-8000-0000000000j2";

function useDouble(double: AppointmentsSupabaseDouble): void {
  installSupabaseDouble(double, mockedCreateClient);
}

describe("findAppointmentById", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("busca una cita por id y pide cabecera, cliente, ítems, servicio y colaborador", async () => {
    const row = { id: appointmentId, status: "confirmed" };
    const double = createAppointmentsSupabaseDouble({ appointments: { data: row, error: null } });
    useDouble(double);

    const result = await findAppointmentById(appointmentId, salonId);

    expect(result).toEqual(row);
    const calls = double.callsFor("appointments");
    expect(calls).toContainEqual({ method: "eq", args: ["id", appointmentId] });
    expect(calls).toContainEqual({ method: "single", args: [] });
    const select = calls.find((call) => call.method === "select")?.args[0];
    expect(String(select)).toContain("customer:customers(");
    expect(String(select)).toContain("items:appointment_items(");
    expect(String(select)).toContain("category:service_categories(");
    expect(String(select)).toContain("employee:employees(");
  });

  it("devuelve null cuando la consulta falla o no encuentra la cita", async () => {
    useDouble(
      createAppointmentsSupabaseDouble({
        appointments: { data: null, error: { message: "no rows" } },
      })
    );

    expect(await findAppointmentById(appointmentId, salonId)).toBeNull();
  });

  it("filtra explícitamente por salon_id además del id de la cita", async () => {
    const double = createAppointmentsSupabaseDouble({ appointments: { data: { id: appointmentId }, error: null } });
    useDouble(double);

    await findAppointmentById(appointmentId, salonId);

    const eqCalls = double.callsFor("appointments").filter((call) => call.method === "eq");
    expect(eqCalls).toEqual([
      { method: "eq", args: ["id", appointmentId] },
      { method: "eq", args: ["salon_id", salonId] },
    ]);
  });
});

describe("findAppointmentsBySalon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("filtra siempre por salón y ordena por inicio ascendente", async () => {
    const double = createAppointmentsSupabaseDouble({ appointments: { data: [], error: null } });
    useDouble(double);

    await findAppointmentsBySalon(salonId);

    const calls = double.callsFor("appointments");
    expect(calls).toContainEqual({ method: "eq", args: ["salon_id", salonId] });
    expect(calls).toContainEqual({ method: "order", args: ["start_time", { ascending: true }] });
  });

  it("aplica estado y rango de fechas solo cuando se piden", async () => {
    const double = createAppointmentsSupabaseDouble({ appointments: { data: [], error: null } });
    useDouble(double);

    await findAppointmentsBySalon(salonId, {
      status: "scheduled",
      startDate: "2030-01-01T05:00:00.000Z",
      endDate: "2030-01-01T04:59:59.999Z",
    });

    const calls = double.callsFor("appointments");
    expect(calls).toContainEqual({ method: "eq", args: ["status", "scheduled"] });
    expect(calls).toContainEqual({ method: "gte", args: ["start_time", "2030-01-01T05:00:00.000Z"] });
    expect(calls).toContainEqual({ method: "lte", args: ["start_time", "2030-01-01T04:59:59.999Z"] });
  });

  it("sin filtros opcionales no agrega condiciones de estado ni de fecha", async () => {
    const double = createAppointmentsSupabaseDouble({ appointments: { data: [], error: null } });
    useDouble(double);

    await findAppointmentsBySalon(salonId, {});

    const methods = double.callsFor("appointments").map((call) => call.method);
    expect(methods).not.toContain("gte");
    expect(methods).not.toContain("lte");
    expect(double.callsFor("appointments").filter((call) => call.method === "eq")).toEqual([
      { method: "eq", args: ["salon_id", salonId] },
    ]);
  });

  it("devuelve la lista de citas tal como llega de la base", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    useDouble(createAppointmentsSupabaseDouble({ appointments: { data: rows, error: null } }));

    expect(await findAppointmentsBySalon(salonId)).toEqual(rows);
  });

  it("devuelve lista vacía cuando la base responde sin datos", async () => {
    useDouble(createAppointmentsSupabaseDouble({ appointments: { data: null, error: null } }));

    expect(await findAppointmentsBySalon(salonId)).toEqual([]);
  });

  it("propaga el error de la consulta para que el llamador decida", async () => {
    useDouble(
      createAppointmentsSupabaseDouble({
        appointments: { data: null, error: { message: "query failed" } },
      })
    );

    await expect(findAppointmentsBySalon(salonId)).rejects.toEqual({ message: "query failed" });
  });
});
