// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { PaymentStandingBanner } from "./payment-standing-banner";

describe("PaymentStandingBanner", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("avisa la fecha de vencimiento y los días de gracia restantes", () => {
    mounted = mountComponent(<PaymentStandingBanner notice={{ overdueSince: "2026-10-01", graceDaysLeft: 3 }} />);

    const banner = mounted.container.querySelector<HTMLElement>('[role="status"]');
    expect(banner?.textContent).toContain("Tu mensualidad venció el 2026-10-01");
    expect(banner?.textContent).toContain("Tienes 3 días para registrar el pago");
    expect(banner?.textContent).toContain("Contacta a GlowBook");
  });

  it("usa el singular cuando queda exactamente un día de gracia", () => {
    mounted = mountComponent(<PaymentStandingBanner notice={{ overdueSince: "2026-10-01", graceDaysLeft: 1 }} />);

    expect(mounted.container.textContent).toContain("Tienes 1 día para registrar el pago");
  });
});
