import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPendingInvitations } from "../data/invitations.repo";
import { findAllSalons } from "../data/salons.repo";
import { getPlatformAdminHome } from "./get-platform-admin-home";

vi.mock("../data/salons.repo", () => ({
  findAllSalons: vi.fn(),
}));

vi.mock("../data/invitations.repo", () => ({
  findPendingInvitations: vi.fn(),
}));

const mockedFindAllSalons = vi.mocked(findAllSalons);
const mockedFindPendingInvitations = vi.mocked(findPendingInvitations);

describe("get platform admin home", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindAllSalons.mockResolvedValue([]);
    mockedFindPendingInvitations.mockResolvedValue([]);
  });

  it("builds the platform dashboard metrics from admin adapters", async () => {
    mockedFindAllSalons.mockResolvedValue([
      { id: "salon-1", is_active: true, name: "Glow A" },
      { id: "salon-2", is_active: false, name: "Glow B" },
    ] as never);
    mockedFindPendingInvitations.mockResolvedValue([
      { id: "invite-1", email: "owner@example.com", token: "token-1" },
    ] as never);

    const view = await getPlatformAdminHome();

    expect(view.metrics).toEqual({
      totalSalons: 2,
      activeSalons: 1,
      pendingInvitations: 1,
    });
    expect(view.salons).toHaveLength(2);
    expect(view.pendingInvitations).toHaveLength(1);
  });
});
