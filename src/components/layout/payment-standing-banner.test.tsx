// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { PaymentStanding } from "@/features/billing/domain/payment-standing";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { PaymentStandingBanner } from "./payment-standing-banner";

function standing(overrides: Partial<PaymentStanding>): PaymentStanding {
  return { state: "grace", overdueSince: "2026-10-01", graceDaysLeft: 3, ...overrides };
}

describe("PaymentStandingBanner", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it.each(["ok", "suspended"] as const)("no muestra nada cuando el estado de pago es %s", (state) => {
    mounted = mountComponent(<PaymentStandingBanner standing={standing({ state })} />);

    expect(mounted.container.innerHTML).toBe("");
  });

  it("en periodo de gracia avisa la fecha de vencimiento y los días restantes", () => {
    mounted = mountComponent(<PaymentStandingBanner standing={standing({ graceDaysLeft: 3 })} />);

    const banner = mounted.container.querySelector<HTMLElement>('[role="status"]');
    expect(banner?.textContent).toContain("Tu mensualidad venció el 2026-10-01");
    expect(banner?.textContent).toContain("Tienes 3 días para registrar el pago");
    expect(banner?.textContent).toContain("Contacta a GlowBook");
  });

  it("usa el singular cuando queda exactamente un día de gracia", () => {
    mounted = mountComponent(<PaymentStandingBanner standing={standing({ graceDaysLeft: 1 })} />);

    expect(mounted.container.textContent).toContain("Tienes 1 día para registrar el pago");
  });
});
