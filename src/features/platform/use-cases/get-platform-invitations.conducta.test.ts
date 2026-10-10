import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findPendingInvitations,
  findRecentAcceptedInvitations,
} from "@/features/platform/data/invitations.repo";
import { findSalonNamesByIds } from "@/features/platform/data/salons.repo";
import { getPlanCatalogSummary } from "@/features/billing/use-cases/commercial-plans";
import { getPlatformInvitations } from "./get-platform-invitations";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Bandeja de invitaciones de la plataforma: marca las vencidas respecto al
// reloj actual, nombra el salón creado a partir de cada aceptacion y solo
// ofrece planes activos para asignar a una nueva invitación.

vi.mock("@/features/platform/data/invitations.repo", () => ({
  findPendingInvitations: vi.fn(),
  findRecentAcceptedInvitations: vi.fn(),
}));

vi.mock("@/features/platform/data/salons.repo", () => ({
  findSalonNamesByIds: vi.fn(),
}));

vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  getPlanCatalogSummary: vi.fn(),
}));

const mockedPending = vi.mocked(findPendingInvitations);
const mockedAccepted = vi.mocked(findRecentAcceptedInvitations);
const mockedSalonNames = vi.mocked(findSalonNamesByIds);
const mockedPlans = vi.mocked(getPlanCatalogSummary);

const NOW = new Date("2026-06-10T12:00:00.000Z");
const PLAN_ID_PRO = "00000000-0000-4000-8000-00000000000a";
const PLAN_ID_DRAFT = "00000000-0000-4000-8000-00000000000d";
const SALON_ID = "00000000-0000-4000-8000-000000000001";
const GONE_SALON_ID = "00000000-0000-4000-8000-000000000002";

const proPlan = {
  id: PLAN_ID_PRO,
  name: "Pro",
  currency: "USD",
  monthlyPrice: 29.9,
  trialDays: 14,
  status: "active" as const,
};
const draftPlan = {
  id: PLAN_ID_DRAFT,
  name: "Borrador",
  currency: "USD",
  monthlyPrice: 5,
  trialDays: 0,
  status: "draft" as const,
};
const plans = [proPlan, draftPlan];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetAllMocks();
  mockedPending.mockResolvedValue([]);
  mockedAccepted.mockResolvedValue([]);
  mockedSalonNames.mockResolvedValue(new Map());
  mockedPlans.mockResolvedValue(plans);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getPlatformInvitations pending invitations", () => {
  it("flags invitations whose expiry is in the past as expired and counts them", async () => {
    mockedPending.mockResolvedValue([
      {
        id: "p-1",
        email: "vencida@example.com",
        status: "pending",
        expires_at: "2026-06-09T12:00:00.000Z",
        created_at: "2026-05-20T12:00:00.000Z",
        plan_id: PLAN_ID_PRO,
      },
      {
        id: "p-2",
        email: "vigente@example.com",
        status: "pending",
        expires_at: "2026-06-20T12:00:00.000Z",
        created_at: "2026-06-06T12:00:00.000Z",
        plan_id: null,
      },
    ]);

    const view = await getPlatformInvitations(ADMIN_PROOF);

    expect(view.pendingInvitations.map((invitation) => [invitation.id, invitation.expired])).toEqual([
      ["p-1", true],
      ["p-2", false],
    ]);
    expect(view.pendingCount).toBe(2);
    expect(view.expiredCount).toBe(1);
  });

  it("treats an invitation expiring exactly now as not yet expired", async () => {
    mockedPending.mockResolvedValue([
      {
        id: "p-1",
        email: "x@example.com",
        status: "pending",
        expires_at: NOW.toISOString(),
        created_at: "2026-06-01T12:00:00.000Z",
        plan_id: null,
      },
    ]);

    const invitation = firstOf((await getPlatformInvitations(ADMIN_PROOF)).pendingInvitations);

    expect(invitation.expired).toBe(false);
  });

  it("names the plan of a pending invitation and leaves it null when the plan is unknown or absent", async () => {
    mockedPending.mockResolvedValue([
      {
        id: "p-1",
        email: "a@example.com",
        status: "pending",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_at: "2026-06-01T12:00:00.000Z",
        plan_id: PLAN_ID_PRO,
      },
      {
        id: "p-2",
        email: "b@example.com",
        status: "pending",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_at: "2026-06-01T12:00:00.000Z",
        plan_id: "00000000-0000-4000-8000-0000000000ff",
      },
      {
        id: "p-3",
        email: "c@example.com",
        status: "pending",
        expires_at: "2099-01-01T00:00:00.000Z",
        created_at: "2026-06-01T12:00:00.000Z",
        plan_id: null,
      },
    ]);

    const view = await getPlatformInvitations(ADMIN_PROOF);

    expect(view.pendingInvitations.map((invitation) => invitation.planName)).toEqual(["Pro", null, null]);
  });

  it("formats the created and expiry dates as labels that keep the year", async () => {
    mockedPending.mockResolvedValue([
      {
        id: "p-1",
        email: "a@example.com",
        status: "pending",
        expires_at: "2026-06-20T12:00:00.000Z",
        created_at: "2026-06-01T12:00:00.000Z",
        plan_id: null,
      },
    ]);

    const invitation = firstOf((await getPlatformInvitations(ADMIN_PROOF)).pendingInvitations);

    expect(invitation.createdAtLabel).toMatch(/2026/);
    expect(invitation.expiresAtLabel).toMatch(/2026/);
  });
});

describe("getPlatformInvitations accepted invitations", () => {
  it("resolves the salón name of each accepted invitation, requesting only the known salón ids", async () => {
    mockedAccepted.mockResolvedValue([
      {
        id: "a-1",
        email: "owner@example.com",
        accepted_at: "2026-06-05T12:00:00.000Z",
        salon_id: SALON_ID,
        plan_id: PLAN_ID_PRO,
      },
      {
        id: "a-2",
        email: "otro@example.com",
        accepted_at: null,
        salon_id: null,
        plan_id: null,
      },
    ]);
    mockedSalonNames.mockResolvedValue(new Map([[SALON_ID, "Glow Studio"]]));

    const view = await getPlatformInvitations(ADMIN_PROOF);

    expect(mockedSalonNames).toHaveBeenCalledWith([SALON_ID]);
    expect(view.acceptedInvitations).toEqual([
      {
        id: "a-1",
        email: "owner@example.com",
        salonName: "Glow Studio",
        planName: "Pro",
        acceptedAtLabel: expect.stringMatching(/2026/),
      },
      {
        id: "a-2",
        email: "otro@example.com",
        salonName: "Salón eliminado",
        planName: null,
        acceptedAtLabel: "—",
      },
    ]);
  });

  it("shows a deleted salón when the accepted salón no longer exists", async () => {
    mockedAccepted.mockResolvedValue([
      {
        id: "a-1",
        email: "owner@example.com",
        accepted_at: "2026-06-05T12:00:00.000Z",
        salon_id: GONE_SALON_ID,
        plan_id: null,
      },
    ]);
    mockedSalonNames.mockResolvedValue(new Map());

    const accepted = firstOf((await getPlatformInvitations(ADMIN_PROOF)).acceptedInvitations);

    expect(accepted.salonName).toBe("Salón eliminado");
    expect(accepted.planName).toBeNull();
  });
});

describe("getPlatformInvitations assignable plans", () => {
  it("offers only active plans, with price formatted to two decimals and the trial length", async () => {
    const view = await getPlatformInvitations(ADMIN_PROOF);

    expect(view.assignablePlans).toEqual([
      { id: PLAN_ID_PRO, name: "Pro", priceLabel: "USD 29.90/mes", trialDays: 14 },
    ]);
  });

  it("offers no plans when the catalogue has none active", async () => {
    mockedPlans.mockResolvedValue([draftPlan]);

    const view = await getPlatformInvitations(ADMIN_PROOF);

    expect(view.assignablePlans).toEqual([]);
  });

  it("reads pending invitations, recent acceptances and the plan catalogue for each view", async () => {
    await getPlatformInvitations(ADMIN_PROOF);

    expect(mockedPending).toHaveBeenCalledTimes(1);
    expect(mockedAccepted).toHaveBeenCalledTimes(1);
    expect(mockedPlans).toHaveBeenCalledTimes(1);
  });
});
