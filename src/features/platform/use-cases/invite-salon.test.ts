import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSalonInvitation } from "@/features/platform/data/invitations.repo";
import { isPlatformAdmin } from "@/lib/auth/session";
import { inviteSalon } from "./invite-salon";

vi.mock("@/features/platform/data/invitations.repo", () => ({
  createSalonInvitation: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  isPlatformAdmin: vi.fn(),
}));

const mockedCreateSalonInvitation = vi.mocked(createSalonInvitation);
const mockedIsPlatformAdmin = vi.mocked(isPlatformAdmin);

describe("invite salon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIsPlatformAdmin.mockResolvedValue(true);
    mockedCreateSalonInvitation.mockResolvedValue("invite-token");
  });

  it("rejects non-platform admins before creating the invitation", async () => {
    mockedIsPlatformAdmin.mockResolvedValue(false);

    const result = await inviteSalon({ email: "owner@example.com" });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });

  it("uses typed input and creates the platform invitation", async () => {
    const result = await inviteSalon({ email: "owner@example.com" });

    expect(result).toEqual({ ok: true, value: "invite-token" });
    expect(mockedCreateSalonInvitation).toHaveBeenCalledWith("owner@example.com");
  });

  it("rejects invalid emails without calling the data adapter", async () => {
    const result = await inviteSalon({ email: "not-an-email" });

    expect(result.ok).toBe(false);
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });
});
