// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getPlatformInvitations, type PlatformInvitationsViewModel } from "@/features/platform/use-cases/get-platform-invitations";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import PlatformInvitationsPage from "./page";

vi.mock("@/lib/auth/session", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-invitations", () => ({
  getPlatformInvitations: vi.fn(),
}));
vi.mock("../regenerate-invite-link", () => ({ RegenerateInviteLink: () => null }));
vi.mock("./invite-salon-form", () => ({ InviteSalonForm: () => null }));

function viewWith(overrides: Partial<PlatformInvitationsViewModel>): PlatformInvitationsViewModel {
  return {
    pendingInvitations: [],
    acceptedInvitations: [],
    assignablePlans: [{ id: "plan-1", name: "Pro", priceLabel: "$30", trialDays: 14 }],
    pendingCount: 0,
    expiredCount: 0,
    ...overrides,
  };
}

describe("PlatformInvitationsPage", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("exige rol de plataforma antes de consultar las invitaciones", async () => {
    vi.mocked(getPlatformInvitations).mockResolvedValue(viewWith({}));

    await PlatformInvitationsPage();

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getPlatformInvitations).toHaveBeenCalled();
  });

  it("muestra 'Sin plan' en las invitaciones pendientes y aceptadas que no tienen plan", async () => {
    vi.mocked(getPlatformInvitations).mockResolvedValue(
      viewWith({
        pendingCount: 1,
        pendingInvitations: [
          {
            id: "inv-1",
            email: "dueña@salon.test",
            planName: null,
            createdAtLabel: "1 oct",
            expiresAtLabel: "8 oct",
            expired: false,
          },
        ],
        acceptedInvitations: [
          {
            id: "inv-2",
            email: "owner@salon.test",
            salonName: "Salón Luna",
            planName: null,
            acceptedAtLabel: "2 oct",
          },
        ],
      })
    );

    mounted = mountComponent(await PlatformInvitationsPage());

    expect(mounted.container.textContent).toContain("1 pendiente");
    expect(mounted.container.textContent).toContain("Pendiente");
    expect(mounted.container.textContent?.match(/Sin plan/g)).toHaveLength(2);
    expect(mounted.container.textContent).toContain("Salón Luna");
  });

  it("muestra el nombre del plan cuando la invitación lo tiene y marca las expiradas", async () => {
    vi.mocked(getPlatformInvitations).mockResolvedValue(
      viewWith({
        pendingCount: 1,
        pendingInvitations: [
          {
            id: "inv-3",
            email: "nuevo@salon.test",
            planName: "Pro",
            createdAtLabel: "1 oct",
            expiresAtLabel: "8 oct",
            expired: true,
          },
        ],
        acceptedInvitations: [
          {
            id: "inv-4",
            email: "acepto@salon.test",
            salonName: "Barbería Norte",
            planName: "Básico",
            acceptedAtLabel: "3 oct",
          },
        ],
      })
    );

    mounted = mountComponent(await PlatformInvitationsPage());

    expect(mounted.container.textContent).not.toContain("Sin plan");
    expect(mounted.container.textContent).toContain("Pro");
    expect(mounted.container.textContent).toContain("Básico");
    expect(mounted.container.textContent).not.toContain("Pendiente");
  });
});
