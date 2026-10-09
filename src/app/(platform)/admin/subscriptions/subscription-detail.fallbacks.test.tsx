// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { CATALOG_MODULES, makeAddon, makeDetail, makeMetric, makePlan } from "@/test/ui-admin-fixtures";
import { SubscriptionDetail } from "./subscription-detail";

vi.mock("./actions", () => ({
  assignPlanAction: vi.fn(),
  registerPaymentAction: vi.fn(),
  giveAddonAction: vi.fn(),
  giveManualExtraAction: vi.fn(),
  cancelExtraAction: vi.fn(),
  resolveAlertAction: vi.fn(),
}));

const CATALOG = {
  plans: [makePlan({ id: "plan-pro", name: "Pro", status: "active" })],
  addons: [makeAddon({ id: "addon-citas", metricKey: "appointments_monthly", kind: "limit_boost" })],
  metrics: [makeMetric({ key: "appointments_monthly", name: "Citas" })],
  modules: CATALOG_MODULES,
};

describe("SubscriptionDetail (ramas de respaldo)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("con plan pero sin asignación vigente la cabecera muestra 'Sin estado'", () => {
    mounted = mountComponent(
      <SubscriptionDetail salonName="Salón Luna" detail={makeDetail({ assignment: null })} catalog={CATALOG} />
    );

    expect(mounted.container.textContent).toContain("Pro · Sin estado · USD 30.00/mes");
  });

  it("un pago sin notas se muestra en el historial sin texto de nota", () => {
    mounted = mountComponent(
      <SubscriptionDetail
        salonName="Salón Luna"
        catalog={CATALOG}
        detail={makeDetail({
          payments: [
            {
              id: "pay-sin-nota",
              amount: 30,
              currency: "USD",
              paidAt: "2026-10-02",
              periodStart: "2026-10-01",
              periodEnd: "2026-10-31",
              notes: "",
            },
          ],
        })}
      />
    );

    expect(mounted.container.textContent).toContain("Historial de pagos");
    expect(mounted.container.textContent).toContain("USD 30.00");
    const history = Array.from(mounted.container.querySelectorAll("div")).find(
      (node) => node.className.includes("divide-y") && node.textContent?.includes("USD 30.00")
    );
    // Solo el párrafo del monto: sin nota no hay un segundo párrafo en la fila.
    expect(history?.firstElementChild?.querySelectorAll("p")).toHaveLength(1);
  });
});
