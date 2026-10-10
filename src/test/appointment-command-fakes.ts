import { vi } from "vitest";
import type { CancelAppointmentDeps } from "@/features/appointments/use-cases/cancel-appointment";
import type { CompleteAppointmentDeps } from "@/features/appointments/use-cases/complete-appointment";
import type { ConfirmAppointmentDeps } from "@/features/appointments/use-cases/confirm-appointment";
import type { CreateAppointmentDeps } from "@/features/appointments/use-cases/create-appointment";
import {
  prepareAppointmentItems,
  type PrepareAppointmentItemsDeps,
} from "@/features/appointments/use-cases/prepare-appointment-items";
import type { UpdateAppointmentDeps } from "@/features/appointments/use-cases/update-appointment";

// Fakes tipados de los comandos de cita. Cada función es un vi.fn con la firma real
// y devuelve un valor de éxito por defecto; cada test sobrescribe lo que necesita.
// Así los tests de comandos no usan vi.mock sobre data/ ni sobre las RPC.

export function fakeConfirmAppointmentDeps() {
  return {
    findAppointment: vi.fn<ConfirmAppointmentDeps["findAppointment"]>(async () => null),
    confirmRpc: vi.fn<ConfirmAppointmentDeps["confirmRpc"]>(async (input) => ({
      appointment_id: input.appointmentId,
      status: "confirmed",
    })),
  } satisfies ConfirmAppointmentDeps;
}

export function fakeCancelAppointmentDeps() {
  return {
    findAppointment: vi.fn<CancelAppointmentDeps["findAppointment"]>(async () => null),
    cancelRpc: vi.fn<CancelAppointmentDeps["cancelRpc"]>(async (input) => ({
      appointment_id: input.appointmentId,
      status: "cancelled",
    })),
    isTemporaryCustomer: vi.fn<CancelAppointmentDeps["isTemporaryCustomer"]>(async () => false),
    promoteCustomer: vi.fn<CancelAppointmentDeps["promoteCustomer"]>(async () => ({ ok: true, value: undefined })),
    deleteTemporaryCustomer: vi.fn<CancelAppointmentDeps["deleteTemporaryCustomer"]>(async () => ({
      ok: true,
      value: undefined,
    })),
  } satisfies CancelAppointmentDeps;
}

export function fakeCompleteAppointmentDeps() {
  return {
    isPaymentMethodEnabled: vi.fn<CompleteAppointmentDeps["isPaymentMethodEnabled"]>(async () => true),
    findAppointment: vi.fn<CompleteAppointmentDeps["findAppointment"]>(async () => null),
    completeRpc: vi.fn<CompleteAppointmentDeps["completeRpc"]>(async (input) => ({
      appointment_id: input.appointmentId,
      status: "completed",
      subtotal: 56,
      discount_amount: 4,
      total_price: 56,
    })),
  } satisfies CompleteAppointmentDeps;
}

// Repositorios y RPC de creación y reprogramación con un único conjunto de fakes.
// Los tests de create/update/prepare los comparten a través de createDepsFrom,
// updateDepsFrom y prepareDepsFrom, que reparten esas mismas funciones entre los Deps.
export function createAppointmentCommandFakes() {
  return {
    findAppointmentCreationResources: vi.fn<PrepareAppointmentItemsDeps["findAppointmentCreationResources"]>(
      async () => ({ customerExists: false, salonConfig: null, businessHours: [], assignments: [] })
    ),
    findExceptionDatesByEmployeeForCommand: vi.fn<PrepareAppointmentItemsDeps["findExceptionDatesByEmployeeForCommand"]>(
      async () => new Map()
    ),
    findOccupiedSlotsByEmployeeForCommand: vi.fn<PrepareAppointmentItemsDeps["findOccupiedSlotsByEmployeeForCommand"]>(
      async () => new Map()
    ),
    findWorkSchedulesByEmployeeForCommand: vi.fn<PrepareAppointmentItemsDeps["findWorkSchedulesByEmployeeForCommand"]>(
      async () => new Map()
    ),
    findAppointmentForCommand: vi.fn<UpdateAppointmentDeps["findAppointmentForCommand"]>(async () => null),
    findAppointmentServiceIdsForCommand: vi.fn<UpdateAppointmentDeps["findAppointmentServiceIdsForCommand"]>(
      async () => []
    ),
    createAppointmentWithRpc: vi.fn<CreateAppointmentDeps["createAppointmentWithRpc"]>(async () => ({
      ok: true,
      appointmentId: "appointment-1",
    })),
    updateAppointmentWithRpc: vi.fn<UpdateAppointmentDeps["updateAppointmentWithRpc"]>(async () => ({ ok: true })),
  };
}

export type AppointmentCommandFakes = ReturnType<typeof createAppointmentCommandFakes>;

export function prepareDepsFrom(fakes: AppointmentCommandFakes): PrepareAppointmentItemsDeps {
  return {
    findAppointmentCreationResources: fakes.findAppointmentCreationResources,
    findExceptionDatesByEmployeeForCommand: fakes.findExceptionDatesByEmployeeForCommand,
    findOccupiedSlotsByEmployeeForCommand: fakes.findOccupiedSlotsByEmployeeForCommand,
    findWorkSchedulesByEmployeeForCommand: fakes.findWorkSchedulesByEmployeeForCommand,
  };
}

export function createDepsFrom(fakes: AppointmentCommandFakes): CreateAppointmentDeps {
  const prepareDeps = prepareDepsFrom(fakes);
  return {
    prepareAppointmentItems: (input) => prepareAppointmentItems(input, prepareDeps),
    createAppointmentWithRpc: fakes.createAppointmentWithRpc,
  };
}

export function updateDepsFrom(fakes: AppointmentCommandFakes): UpdateAppointmentDeps {
  const prepareDeps = prepareDepsFrom(fakes);
  return {
    findAppointmentForCommand: fakes.findAppointmentForCommand,
    findAppointmentServiceIdsForCommand: fakes.findAppointmentServiceIdsForCommand,
    prepareAppointmentItems: (input) => prepareAppointmentItems(input, prepareDeps),
    updateAppointmentWithRpc: fakes.updateAppointmentWithRpc,
  };
}
