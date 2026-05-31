import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findPendingInvitations } from "../data/invitations.repo";
import { getPlatformInvitations } from "./get-platform-invitations";

vi.mock("../data/invitations.repo", () => ({
  findPendingInvitations: vi.fn(),
}));

const mockedFindPendingInvitations = vi.mocked(findPendingInvitations);

describe("get platform invitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindPendingInvitations.mockResolvedValue([]);
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
        token: "token-1",
        status: "pending",
        created_at: "2026-05-29T12:00:00.000Z",
        expires_at: "2026-05-31T12:00:00.000Z",
      },
      {
        id: "invite-2",
        email: "expired@example.com",
        token: "token-2",
        status: "pending",
        created_at: "2026-05-20T12:00:00.000Z",
        expires_at: "2026-05-21T12:00:00.000Z",
      },
    ]);

    const view = await getPlatformInvitations();

    expect(view.pendingCount).toBe(2);
    expect(view.expiredCount).toBe(1);
    expect(view.pendingInvitations[0]).toMatchObject({
      id: "invite-1",
      email: "owner@example.com",
      token: "token-1",
      expired: false,
    });
    expect(view.pendingInvitations[1]).toMatchObject({
      expired: true,
    });
  });
});
