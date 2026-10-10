import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findPendingInvitations,
  findRecentAcceptedInvitations,
} from "../data/invitations.repo";
import { getPlanCatalogSummary } from "@/features/billing/use-cases/commercial-plans";
import { findSalonNamesByIds } from "../data/salons.repo";
import { getPlatformInvitations } from "./get-platform-invitations";

vi.mock("../data/invitations.repo", () => ({
  findPendingInvitations: vi.fn(),
  findRecentAcceptedInvitations: vi.fn(),
}));

vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  getPlanCatalogSummary: vi.fn(),
}));

vi.mock("../data/salons.repo", () => ({
  findSalonNamesByIds: vi.fn(),
}));

const mockedFindPendingInvitations = vi.mocked(findPendingInvitations);
const mockedFindRecentAcceptedInvitations = vi.mocked(findRecentAcceptedInvitations);
const mockedGetPlanCatalogSummary = vi.mocked(getPlanCatalogSummary);
const mockedFindSalonNamesByIds = vi.mocked(findSalonNamesByIds);

const plan = {
  id: "plan-1",
  name: "Agenda",
  currency: "USD",
  monthlyPrice: 14,
  trialDays: 14,
  status: "active" as const,
};

describe("get platform invitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindPendingInvitations.mockResolvedValue([]);
    mockedFindRecentAcceptedInvitations.mockResolvedValue([]);
    mockedGetPlanCatalogSummary.mockResolvedValue([plan]);
    mockedFindSalonNamesByIds.mockResolvedValue(new Map());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps pending invitations and counts expired entries", async () => {
    mockedFindPendingInvitations.mockResolvedValue([
      {
        id: "invite-1",
        email: "owner@example.com",
        status: "pending",
        created_at: "2026-05-29T12:00:00.000Z",
        expires_at: "2026-05-31T12:00:00.000Z",
        plan_id: "plan-1",
      },
      {
        id: "invite-2",
        email: "expired@example.com",
        status: "pending",
        created_at: "2026-05-20T12:00:00.000Z",
        expires_at: "2026-05-21T12:00:00.000Z",
        plan_id: null,
      },
    ]);

    const view = await getPlatformInvitations();

    expect(view.pendingCount).toBe(2);
    expect(view.expiredCount).toBe(1);
    expect(view.pendingInvitations[0]).toMatchObject({
      id: "invite-1",
      email: "owner@example.com",
      planName: "Agenda",
      expired: false,
    });
    expect(view.pendingInvitations[1]).toMatchObject({
      planName: null,
      expired: true,
    });
  });

  it("lists active plans as assignable and maps accepted invitations", async () => {
    mockedFindRecentAcceptedInvitations.mockResolvedValue([
      {
        id: "invite-3",
        email: "done@example.com",
        accepted_at: "2026-05-28T15:00:00.000Z",
        salon_id: "salon-1",
        plan_id: "plan-1",
      },
    ]);
    mockedFindSalonNamesByIds.mockResolvedValue(new Map([["salon-1", "Glow Salón"]]));

    const view = await getPlatformInvitations();

    expect(view.assignablePlans).toEqual([
      { id: "plan-1", name: "Agenda", priceLabel: "USD 14.00/mes", trialDays: 14 },
    ]);
    expect(view.acceptedInvitations[0]).toMatchObject({
      email: "done@example.com",
      salonName: "Glow Salón",
      planName: "Agenda",
    });
  });
});
