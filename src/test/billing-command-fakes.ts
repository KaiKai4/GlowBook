import { vi } from "vitest";
import type { CommercialAddonCommandDeps } from "@/features/billing/use-cases/commercial-addons";
import type { CommercialPlanCommandDeps } from "@/features/billing/use-cases/commercial-plans";
import type { SalonPlanExtrasCommandDeps } from "@/features/billing/use-cases/salon-plan-extras";

// Fakes tipados de las dependencias de los comandos de billing con escritura.
// Cada función es un vi.fn con la firma real: el test afirma llamadas y ajusta
// resultados sin vi.mock de los repositorios. Los valores por defecto son los
// de una escritura correcta; cada test sobrescribe solo lo que necesita.

export function fakeCommercialPlanDeps() {
  return {
    saveCommercialPlan: vi.fn<CommercialPlanCommandDeps["saveCommercialPlan"]>(async () => "plan-id-1"),
    archiveCommercialPlan: vi.fn<CommercialPlanCommandDeps["archiveCommercialPlan"]>(async () => undefined),
    countPlanAssignments: vi.fn<CommercialPlanCommandDeps["countPlanAssignments"]>(async () => 0),
    deleteCommercialPlan: vi.fn<CommercialPlanCommandDeps["deleteCommercialPlan"]>(async () => undefined),
    savePlanModule: vi.fn<CommercialPlanCommandDeps["savePlanModule"]>(async () => undefined),
    savePlanLimit: vi.fn<CommercialPlanCommandDeps["savePlanLimit"]>(async () => undefined),
    publishAuditEvent: vi.fn<CommercialPlanCommandDeps["publishAuditEvent"]>(async () => []),
  } satisfies CommercialPlanCommandDeps;
}

export function fakeCommercialAddonDeps() {
  return {
    saveCommercialAddon: vi.fn<CommercialAddonCommandDeps["saveCommercialAddon"]>(async () => "addon-1"),
    archiveCommercialAddon: vi.fn<CommercialAddonCommandDeps["archiveCommercialAddon"]>(async () => undefined),
    countAddonAssignments: vi.fn<CommercialAddonCommandDeps["countAddonAssignments"]>(async () => 0),
    deleteCommercialAddon: vi.fn<CommercialAddonCommandDeps["deleteCommercialAddon"]>(async () => undefined),
    publishAuditEvent: vi.fn<CommercialAddonCommandDeps["publishAuditEvent"]>(async () => []),
  } satisfies CommercialAddonCommandDeps;
}

export function fakeSalonPlanExtrasDeps() {
  return {
    findCommercialAddonById: vi.fn<SalonPlanExtrasCommandDeps["findCommercialAddonById"]>(async () => null),
    saveSalonPlanOverride: vi.fn<SalonPlanExtrasCommandDeps["saveSalonPlanOverride"]>(async () => undefined),
    updateSalonPlanOverrideStatus: vi.fn<SalonPlanExtrasCommandDeps["updateSalonPlanOverrideStatus"]>(async () => undefined),
    publishAuditEvent: vi.fn<SalonPlanExtrasCommandDeps["publishAuditEvent"]>(async () => []),
  } satisfies SalonPlanExtrasCommandDeps;
}
