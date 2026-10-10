// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import { assignPlanAction, registerPaymentAction } from "./actions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { changeFieldValue, clickElement, flushAsync, getButtonByText, getFieldByName } from "@/test/ui-admin-dom";
import { CATALOG_MODULES, makeAddon, makeDetail, makeLimit, makeMetric, makePlan } from "@/test/ui-admin-fixtures";
import { SubscriptionDetail } from "./subscription-detail";
import { UUID_PATTERN, idempotencyKeyOf, settleSubmission } from "@/test/form-intent-dom";
import { SAVED_WITH_WARNINGS_MESSAGE } from "@/components/forms/use-submission-intent";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => toast,
}));

vi.mock("./actions", () => ({
  assignPlanAction: vi.fn(),
  registerPaymentAction: vi.fn(),
  giveAddonAction: vi.fn(),
  giveManualExtraAction: vi.fn(),
  cancelExtraAction: vi.fn(),
  resolveAlertAction: vi.fn(),
}));

const PLAN_PRO = makePlan({
  id: "plan-pro",
  name: "Pro",
  monthlyPrice: 30,
  trialDays: 14,
  status: "active",
});
const PLAN_BASICO = makePlan({ id: "plan-basico", name: "Básico", monthlyPrice: 12, trialDays: 0, status: "active" });

const CATALOG = {
  plans: [PLAN_PRO, PLAN_BASICO],
  addons: [makeAddon({ id: "addon-citas", metricKey: "appointments_monthly", kind: "limit_boost" })],
  metrics: [makeMetric({ key: "appointments_monthly", name: "Citas" })],
  modules: CATALOG_MODULES,
};

function renderDetail(detail = makeDetail()): MountedComponent {
  return mountComponent(<SubscriptionDetail salonName="Salón Luna" detail={detail} catalog={CATALOG} />);
}

function tabButton(container: HTMLElement, label: string): HTMLButtonElement {
  return getButtonByText(container, label);
}

describe("SubscriptionDetail registro de pago con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(registerPaymentAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("envía idempotency_key y la mantiene al reintentar tras un error", async () => {
    vi.mocked(registerPaymentAction)
      .mockResolvedValueOnce({ ok: false, message: "Ya existe un pago para ese período" })
      .mockResolvedValueOnce({ ok: true, message: "Pago registrado" });
    mounted = renderDetail();
    const paymentButton = getButtonByText(mounted.container, "Registrar pago");

    clickElement(paymentButton);
    await settleSubmission();
    // Tras la acción React reinicia el formulario a sus valores por defecto: el reintento envía los mismos datos.
    clickElement(getButtonByText(mounted.container, "Registrar pago"));
    await settleSubmission();

    const calls = vi.mocked(registerPaymentAction).mock.calls;
    expect(calls).toHaveLength(2);
    const firstKey = idempotencyKeyOf(calls[0]?.[1]);
    expect(firstKey).toMatch(UUID_PATTERN);
    expect(idempotencyKeyOf(calls[1]?.[1])).toBe(firstKey);
  });
});

describe("SubscriptionDetail", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(assignPlanAction).mockReset();
    vi.mocked(registerPaymentAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("resume el plan, el estado y el total mensual del salón en la cabecera", () => {
    mounted = renderDetail();

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Salón Luna");
    expect(mounted.container.textContent).toContain("Pro · Activo · USD 30.00/mes");
  });

  it("indica que el salón no tiene plan cuando no hay asignación", () => {
    mounted = renderDetail(makeDetail({ assignment: null, plan: null, limits: [], enabledModules: [], monthlyTotal: 0, planPrice: 0 }));

    expect(mounted.container.textContent).toContain("Este salón todavía no tiene plan asignado.");
    expect(mounted.container.textContent).toContain("Asignar plan");
    expect(mounted.container.textContent).toContain("Asigna un plan antes de registrar pagos.");
  });

  it("muestra el precio del plan, los extras y el total en las métricas de la pestaña Plan", () => {
    mounted = renderDetail(makeDetail({ extrasPrice: 5, monthlyTotal: 35 }));

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Plan base");
    expect(text).toContain("USD 30.00");
    expect(text).toContain("Extras");
    expect(text).toContain("USD 5.00");
    expect(text).toContain("Total mensual");
    expect(text).toContain("USD 35.00");
    expect(text).toContain("Pagado hasta");
  });

  it("muestra el fin del trial cuando el salón aún no tiene período pagado", () => {
    mounted = renderDetail(
      makeDetail({
        assignment: {
          planId: "plan-pro",
          status: "trialing",
          startsAt: "2026-10-01",
          endsAt: null,
          trialEndsAt: "2026-10-15",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          notes: "",
        },
      })
    );

    expect(mounted.container.textContent).toContain("Trial termina");
    expect(mounted.container.textContent).toContain("En trial");
  });

  it("cambia el título y el botón del formulario según tenga o no asignación", () => {
    mounted = renderDetail();
    expect(mounted.container.textContent).toContain("Cambiar plan o estado");
    expect(getButtonByText(mounted.container, "Guardar cambios")).toBeTruthy();
    mounted.unmount();

    mounted = renderDetail(makeDetail({ assignment: null, plan: null, limits: [], enabledModules: [] }));
    expect(mounted.container.textContent).toContain("Asignar plan");
  });

  it("envía el plan y el salón elegidos a la acción de asignación", async () => {
    vi.mocked(assignPlanAction).mockResolvedValue({ ok: true, message: "Plan asignado" });
    mounted = renderDetail(makeDetail({ assignment: null, plan: null, limits: [], enabledModules: [] }));

    clickElement(getButtonByText(mounted.container, "Asignar plan"));
    await flushAsync();

    const [, formData] = vi.mocked(assignPlanAction).mock.calls[0]!;
    expect(formData.get("salonId")).toBe("salon-1");
    expect(formData.get("planId")).toBe("");
  });

  it("calcula el fin del trial a partir del plan elegido y sus días de prueba", () => {
    mounted = renderDetail(makeDetail({ assignment: null, plan: null, limits: [], enabledModules: [] }));

    expect(mounted.container.textContent).toContain("Sin trial");
    expect(mounted.container.textContent).toContain("Selecciona un plan");

    clickElement(getButtonByText(mounted.container, "Selecciona un plan"));
    clickElement(
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) =>
        option.textContent?.includes("Pro")
      )!
    );

    expect(getFieldByName<HTMLInputElement>(mounted.container, "planId").value).toBe("plan-pro");
    expect(mounted.container.textContent).toContain("14 días de prueba del plan");
    expect(mounted.container.textContent).not.toContain("Sin trial");
  });

  it("informa que un plan sin prueba no ofrece trial", () => {
    mounted = renderDetail(makeDetail({ assignment: null, plan: null, limits: [], enabledModules: [] }));

    clickElement(getButtonByText(mounted.container, "Selecciona un plan"));
    clickElement(
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) =>
        option.textContent?.includes("Básico")
      )!
    );

    expect(mounted.container.textContent).toContain("Este plan no ofrece prueba");
  });

  it("explica que el trial no aplica cuando el estado deja de ser trial", () => {
    mounted = renderDetail();

    clickElement(getButtonByText(mounted.container, "Activo"));
    clickElement(
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) =>
        option.textContent?.trim() === "En trial"
      )!
    );

    expect(getFieldByName<HTMLInputElement>(mounted.container, "status").value).toBe("trialing");
    expect(mounted.container.textContent).toContain("14 días de prueba del plan");
  });

  it("permite programar una suspensión en una fecha y la muestra con su valor", () => {
    mounted = renderDetail();
    expect(mounted.container.querySelector('input[name="endsAt"]')).toBeNull();

    clickElement(getButtonByText(mounted.container, "Programar suspension en una fecha"));

    expect(getFieldByName<HTMLInputElement>(mounted.container, "endsAt").type).toBe("date");
  });

  it("registra un pago con el monto total mensual por defecto y el historial de pagos", () => {
    mounted = renderDetail(
      makeDetail({
        payments: [
          {
            id: "pay-1",
            amount: 30,
            currency: "USD",
            paidAt: "2026-10-02",
            periodStart: "2026-10-01",
            periodEnd: "2026-10-31",
            notes: "Yappy",
          },
        ],
      })
    );

    expect(getFieldByName<HTMLInputElement>(mounted.container, "amount").value).toBe("30.00");
    expect(mounted.container.textContent).toContain("Historial de pagos");
    expect(mounted.container.textContent).toContain("USD 30.00");
    expect(mounted.container.textContent).toContain("Yappy");
    expect(mounted.container.textContent).toContain("Período vigente:");
  });

  it("avisa con el toast de advertencia cuando el pago se guardó pero un efecto posterior falló", async () => {
    vi.mocked(registerPaymentAction).mockResolvedValueOnce({
      ok: true,
      message: "Pago registrado. La suscripción quedó activa con su mes de uso.",
      warnings: ["La auditoria no se registro."],
    });
    mounted = renderDetail();

    clickElement(getButtonByText(mounted.container, "Registrar pago"));
    await settleSubmission();

    expect(toast.warning).toHaveBeenCalledWith(SAVED_WITH_WARNINGS_MESSAGE);
  });

  it("no muestra advertencias cuando el pago se registra sin incidencias", async () => {
    toast.warning.mockClear();
    vi.mocked(registerPaymentAction).mockResolvedValueOnce({ ok: true, message: "Pago registrado" });
    mounted = renderDetail();

    clickElement(getButtonByText(mounted.container, "Registrar pago"));
    await settleSubmission();

    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("envía el pago con el monto editado a la acción de registro", async () => {
    vi.mocked(registerPaymentAction).mockResolvedValue(PLATFORM_PLAN_IDLE_STATE);
    mounted = renderDetail();

    // Hay dos formularios con campo "notes": se toma el del formulario de pago.
    const paymentForm = getFieldByName<HTMLInputElement>(mounted.container, "amount").closest("form");
    if (!paymentForm) throw new Error("Formulario de pago no encontrado");
    changeFieldValue(getFieldByName<HTMLInputElement>(paymentForm, "amount"), "25.50");
    changeFieldValue(getFieldByName<HTMLInputElement>(paymentForm, "notes"), "Efectivo");
    clickElement(getButtonByText(mounted.container, "Registrar pago"));
    await flushAsync();

    const [, formData] = vi.mocked(registerPaymentAction).mock.calls[0]!;
    expect(formData.get("salonId")).toBe("salon-1");
    expect(formData.get("amount")).toBe("25.50");
    expect(formData.get("notes")).toBe("Efectivo");
  });

  it("cambia de pestaña y muestra el uso de límites, con el contador de alertas en Uso", () => {
    mounted = renderDetail(makeDetail({ limits: [makeLimit({ warningLevel: "near_limit", message: "Cerca" })] }));
    expect(mounted.container.textContent).toContain("Total mensual");
    expect(tabButton(mounted.container, "Uso").textContent).toContain("1");

    clickElement(tabButton(mounted.container, "Uso"));

    expect(mounted.container.textContent).toContain("Consumo de límites");
    expect(mounted.container.textContent).not.toContain("Registrar pago");
  });

  it("muestra el número de extras vigentes en la pestaña Extras", () => {
    mounted = renderDetail(
      makeDetail({
        extras: [
          { id: "e1", name: "Citas extra", detail: "", quantity: 1, isGift: true, monthlyPrice: 0, endsAt: null, reason: "" },
        ],
      })
    );

    expect(tabButton(mounted.container, "Extras").textContent).toContain("1");
    clickElement(tabButton(mounted.container, "Extras"));
    expect(mounted.container.textContent).toContain("Extras vigentes");
    expect(mounted.container.textContent).toContain("Citas extra");
  });

  it("al ampliar un límite desde Uso abre Extras con ese límite sugerido", () => {
    mounted = renderDetail(
      makeDetail({ limits: [makeLimit({ warningLevel: "blocked", message: "Bloqueado", percentage: 100, used: 100 })] })
    );

    clickElement(tabButton(mounted.container, "Uso"));
    clickElement(getButtonByText(mounted.container, "Ampliar límite con un extra"));

    expect(mounted.container.textContent).toContain("Estas ampliando Citas.");
    expect(mounted.container.textContent).toContain("Extras vigentes");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "addonId").value).toBe("addon-citas");
  });
});
