import { describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { err, ok, type Result } from "@/infra/result";
import type { AppointmentCommandState } from "../data/appointment-commands.repo";
import {
  cancelAppointment,
  type CancelAppointmentDeps,
  type CancelAppointmentInput,
} from "./cancel-appointment";

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const appointmentId = "00000000-0000-4000-8000-0000000000a1";
const salonId = "00000000-0000-4000-8000-0000000000b1";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
const customerId = "00000000-0000-4000-8000-0000000000d1";

const mockedCaptureError = vi.mocked(captureError);

type AppointmentStatus = AppointmentCommandState["status"];

function appointmentIn(status: AppointmentStatus, customer: string | null = customerId): AppointmentCommandState {
  return { id: appointmentId, salon_id: salonId, status, customer_id: customer };
}

/** Fakes tipados de las dependencias. Por defecto: cita agendada, cliente permanente, todo correcto. */
function makeDeps(overrides: Partial<CancelAppointmentDeps> = {}): CancelAppointmentDeps {
  return {
    findAppointment: vi.fn<CancelAppointmentDeps["findAppointment"]>(async () => appointmentIn("scheduled")),
    cancelRpc: vi.fn<CancelAppointmentDeps["cancelRpc"]>(async () => ({
      appointment_id: appointmentId,
      status: "cancelled",
    })),
    isTemporaryCustomer: vi.fn<CancelAppointmentDeps["isTemporaryCustomer"]>(async () => false),
    promoteCustomer: vi.fn<CancelAppointmentDeps["promoteCustomer"]>(async (): Promise<Result<void>> => ok(undefined)),
    deleteTemporaryCustomer: vi.fn<CancelAppointmentDeps["deleteTemporaryCustomer"]>(
      async (): Promise<Result<void>> => ok(undefined)
    ),
    ...overrides,
  };
}

function input(overrides: Partial<CancelAppointmentInput> = {}): CancelAppointmentInput {
  return {
    appointmentId,
    salonId,
    idempotencyKey,
    customerDisposition: "keep",
    ...overrides,
  };
}

describe("cancelAppointment: estado y agenda", () => {
  it("cierra la cita y libera la agenda en una única RPC, dentro del salón", async () => {
    const deps = makeDeps();

    const result = await cancelAppointment(input(), deps);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deps.findAppointment).toHaveBeenCalledWith(appointmentId, salonId);
    expect(deps.cancelRpc).toHaveBeenCalledTimes(1);
    expect(deps.cancelRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("confirmed también puede cancelarse", async () => {
    const deps = makeDeps({ findAppointment: async () => appointmentIn("confirmed") });

    expect(await cancelAppointment(input(), deps)).toEqual({ ok: true, value: undefined });
    expect(deps.cancelRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("no llama a la RPC si la cita no existe en el salón", async () => {
    const deps = makeDeps({ findAppointment: async () => null });

    expect(await cancelAppointment(input(), deps)).toEqual(err("Cita no encontrada."));
    expect(deps.cancelRpc).not.toHaveBeenCalled();
  });

  it("trata un fallo al buscar la cita como no encontrada y registra el error", async () => {
    const failure = new Error("connection lost");
    const deps = makeDeps({
      findAppointment: async () => {
        throw failure;
      },
    });

    expect(await cancelAppointment(input(), deps)).toEqual(err("Cita no encontrada."));
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "cancel" });
    expect(deps.cancelRpc).not.toHaveBeenCalled();
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "rechaza cancelar una cita en estado %s sin llamar a la RPC",
    async (status) => {
      const deps = makeDeps({ findAppointment: async () => appointmentIn(status) });

      expect(await cancelAppointment(input(), deps)).toEqual(
        err(`No se puede cambiar el estado de "${status}" a "cancelled".`)
      );
      expect(deps.cancelRpc).not.toHaveBeenCalled();
    }
  );
});

describe("cancelAppointment: fallos de la RPC", () => {
  it("un fallo interno devuelve el mensaje genérico, registra el error y no toca al cliente", async () => {
    const failure = new Error("write failed");
    const deps = makeDeps({
      cancelRpc: async () => {
        throw failure;
      },
    });

    expect(await cancelAppointment(input({ customerDisposition: "promote" }), deps)).toEqual(
      err("Error al cancelar la cita.")
    );
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "errors", action: "public-message" });
    expect(deps.isTemporaryCustomer).not.toHaveBeenCalled();
    expect(deps.promoteCustomer).not.toHaveBeenCalled();
  });

  it("muestra el motivo de dominio si la base rechaza la transición (carrera con completar)", async () => {
    const deps = makeDeps({
      cancelRpc: async () => {
        throw { code: "P0001", message: 'No se puede cambiar el estado de "completed" a "cancelled".' };
      },
    });

    expect(await cancelAppointment(input(), deps)).toEqual(
      err('No se puede cambiar el estado de "completed" a "cancelled".')
    );
  });
});

describe("cancelAppointment: decisión sobre el cliente temporal", () => {
  it("con keep no toca al cliente ni consulta si es temporal", async () => {
    const deps = makeDeps({ isTemporaryCustomer: vi.fn(async () => true) });

    expect(await cancelAppointment(input({ customerDisposition: "keep" }), deps)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(deps.isTemporaryCustomer).not.toHaveBeenCalled();
    expect(deps.promoteCustomer).not.toHaveBeenCalled();
    expect(deps.deleteTemporaryCustomer).not.toHaveBeenCalled();
  });

  it("promote sobre un cliente temporal lo guarda y no lo descarta", async () => {
    const deps = makeDeps({ isTemporaryCustomer: vi.fn(async () => true) });

    expect(await cancelAppointment(input({ customerDisposition: "promote" }), deps)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(deps.isTemporaryCustomer).toHaveBeenCalledWith(customerId, salonId);
    expect(deps.promoteCustomer).toHaveBeenCalledWith(customerId, salonId);
    expect(deps.deleteTemporaryCustomer).not.toHaveBeenCalled();
  });

  it("discard sobre un cliente temporal descarta sus datos y no lo promueve", async () => {
    const deps = makeDeps({ isTemporaryCustomer: vi.fn(async () => true) });

    expect(await cancelAppointment(input({ customerDisposition: "discard" }), deps)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(deps.deleteTemporaryCustomer).toHaveBeenCalledWith(customerId);
    expect(deps.promoteCustomer).not.toHaveBeenCalled();
  });

  it("un cliente permanente nunca cambia desde la cancelación, aunque se pida promover o descartar", async () => {
    const deps = makeDeps({ isTemporaryCustomer: vi.fn(async () => false) });

    await cancelAppointment(input({ customerDisposition: "promote" }), deps);
    await cancelAppointment(input({ customerDisposition: "discard" }), deps);

    expect(deps.promoteCustomer).not.toHaveBeenCalled();
    expect(deps.deleteTemporaryCustomer).not.toHaveBeenCalled();
  });

  it("una cita sin cliente no consulta ni modifica clientes", async () => {
    const deps = makeDeps({ findAppointment: async () => appointmentIn("scheduled", null) });

    expect(await cancelAppointment(input({ customerDisposition: "promote" }), deps)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(deps.isTemporaryCustomer).not.toHaveBeenCalled();
    expect(deps.promoteCustomer).not.toHaveBeenCalled();
  });

  it("si promover falla, la cita sigue cancelada y el aviso viaja en warnings", async () => {
    const deps = makeDeps({
      isTemporaryCustomer: vi.fn(async () => true),
      promoteCustomer: async () => err("Error al guardar el cliente."),
    });

    expect(await cancelAppointment(input({ customerDisposition: "promote" }), deps)).toEqual({
      ok: true,
      value: undefined,
      warnings: ["La cita se canceló, pero no pudimos guardar al cliente: Error al guardar el cliente."],
    });
    expect(deps.cancelRpc).toHaveBeenCalledTimes(1);
  });

  it("si descartar falla, la cita sigue cancelada y el aviso viaja en warnings", async () => {
    const deps = makeDeps({
      isTemporaryCustomer: vi.fn(async () => true),
      deleteTemporaryCustomer: async () => err("Error al descartar el cliente."),
    });

    expect(await cancelAppointment(input({ customerDisposition: "discard" }), deps)).toEqual({
      ok: true,
      value: undefined,
      warnings: [
        "La cita se canceló, pero no pudimos descartar los datos temporales del cliente: Error al descartar el cliente.",
      ],
    });
  });

  it("si consultar el cliente lanza, la cita queda cancelada, se registra el error y hay aviso", async () => {
    const failure = new Error("lookup failed");
    const deps = makeDeps({
      isTemporaryCustomer: async () => {
        throw failure;
      },
    });

    expect(await cancelAppointment(input({ customerDisposition: "promote" }), deps)).toEqual({
      ok: true,
      value: undefined,
      warnings: ["La cita se canceló, pero no pudimos actualizar los datos del cliente."],
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
      module: "appointments",
      action: "cancel-customer",
    });
    expect(deps.promoteCustomer).not.toHaveBeenCalled();
  });
});
