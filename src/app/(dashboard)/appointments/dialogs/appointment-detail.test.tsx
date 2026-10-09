// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { confirmAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { SALON_TZ } from "@/test/ui-appointments-fixtures";
import { buttonWithText, click, clickAndSettle } from "@/test/ui-appointments-dom";
import { flushAsync } from "@/test/ui-shared-dom";
import { AppointmentDetailDialog } from "./appointment-detail";

// La clave de idempotencia se calcula con SHA-256 asíncrono antes de llamar a la acción.
async function settleSubmission(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await flushAsync();
}

const toastApi = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({ useToast: () => toastApi }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  confirmAppointmentAction: vi.fn(),
}));

type DetailAppt = Parameters<typeof AppointmentDetailDialog>[0]["appt"];

const START = "2026-10-12T14:00:00-05:00";
const END = "2026-10-12T15:30:00-05:00";

function buildDetail(overrides: Partial<DetailAppt> = {}): DetailAppt {
  return {
    id: "appt-1",
    status: "scheduled",
    start_time: START,
    end_time: END,
    total_price: "60",
    discount_amount: 5,
    completion_price_note: null,
    notes: null,
    customer: { first_name: "Ana", last_name: "Pérez", phone: "+507 6123-4567" },
    items: [
      {
        id: "item-1",
        start_time: START,
        end_time: "2026-10-12T15:30:00-05:00",
        price: 40,
        discount_amount: 5,
        service: { name: "Tinte", duration_minutes: 90 },
        employee: { first_name: "Lucía", last_name: "Gómez" },
      },
      {
        id: "item-2",
        start_time: "2026-10-12T15:30:00-05:00",
        end_time: "2026-10-12T16:00:00-05:00",
        price: 25,
        discount_amount: 0,
        service: null,
        employee: null,
      },
    ],
    ...overrides,
  };
}

describe("AppointmentDetailDialog", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    toastApi.success.mockReset();
    toastApi.error.mockReset();
    router.refresh.mockReset();
    vi.mocked(confirmAppointmentAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  function render(props: Partial<Parameters<typeof AppointmentDetailDialog>[0]> = {}) {
    const onClose = vi.fn();
    mounted = mountComponent(
      <AppointmentDetailDialog
        appt={buildDetail()}
        tz={SALON_TZ}
        open
        onClose={onClose}
        canManage
        {...props}
      />
    );
    return { container: mounted.container, onClose };
  }

  it("muestra el estado, el cliente y su teléfono", () => {
    const { container } = render();

    expect(container.querySelector("h2")?.textContent).toBe("Detalles de la cita");
    expect(container.textContent).toContain("Agendada");
    expect(container.textContent).toContain("Ana Pérez");
    expect(container.textContent).toContain("+507 6123-4567");
  });

  it.each([
    ["scheduled", "Agendada"],
    ["confirmed", "Confirmada"],
    ["completed", "Completada"],
    ["cancelled", "Cancelada"],
    ["no_show", "No asistió"],
  ])("muestra el estado %s como insignia con su texto", (status, label) => {
    const { container } = render({ appt: buildDetail({ status }) });

    const badge = Array.from(container.querySelectorAll("span")).find(
      (span) => span.textContent === label,
    );
    expect(badge).toBeDefined();
    expect(badge?.querySelector("svg")).not.toBeNull();
  });

  it("enlaza el WhatsApp del cliente solo con dígitos y en una pestaña nueva", () => {
    const { container } = render();

    const whatsapp = container.querySelector<HTMLAnchorElement>('a[title="Contactar por WhatsApp"]');
    expect(whatsapp?.getAttribute("href")).toBe("https://wa.me/50761234567");
    expect(whatsapp?.target).toBe("_blank");
    expect(whatsapp?.rel).toBe("noopener noreferrer");
  });

  it("muestra cliente desconocido y sin WhatsApp cuando la cita no tiene cliente", () => {
    const { container } = render({ appt: buildDetail({ customer: null }) });

    expect(container.textContent).toContain("Cliente desconocido");
    expect(container.querySelector('a[title="Contactar por WhatsApp"]')).toBeNull();
  });

  it("lista cada servicio con su profesional, horario, precio neto y duración", () => {
    const { container } = render();

    const text = container.textContent ?? "";
    expect(text).toContain("Tinte");
    expect(text).toContain("Lucía Gómez");
    expect(text).toContain(`${formatTimeTz(new Date(START), SALON_TZ)}–${formatTimeTz(new Date(END), SALON_TZ)}`);
    expect(text).toContain(`-${formatCurrency(5)}`);
    expect(text).toContain(formatCurrency(35));
    expect(text).toContain("90 min");
  });

  it("nunca muestra un precio neto negativo cuando el descuento supera el precio del servicio", () => {
    const { container } = render({
      appt: buildDetail({
        items: [
          {
            id: "item-x",
            start_time: START,
            end_time: END,
            price: 10,
            discount_amount: 25,
            service: { name: "Promo", duration_minutes: 30 },
            employee: null,
          },
        ],
      }),
    });

    expect(container.textContent).toContain(formatCurrency(0));
    expect(container.textContent).not.toContain(formatCurrency(-15));
  });

  it("calcula subtotal, descuento y total cobrado desde los valores numéricos del detalle", () => {
    const { container } = render();

    const text = container.textContent ?? "";
    expect(text).toContain("Subtotal servicios");
    expect(text).toContain(formatCurrency(65));
    expect(text).toContain("Descuento");
    expect(text).toContain("Total cobrado");
    expect(text).toContain(formatCurrency(60));
  });

  it("oculta la fila de descuento cuando no hay descuento", () => {
    const { container } = render({
      appt: buildDetail({
        discount_amount: null,
        items: [
          {
            id: "solo",
            start_time: START,
            end_time: END,
            price: 30,
            discount_amount: 0,
            service: { name: "Corte", duration_minutes: 30 },
            employee: null,
          },
        ],
      }),
    });

    expect(container.textContent).not.toContain("Descuento");
  });

  it("muestra la nota de cobro y las notas solo cuando existen", () => {
    const { container, onClose } = render({
      appt: buildDetail({ completion_price_note: "Promo de temporada", notes: "Alergia al amoniaco" }),
    });
    expect(container.textContent).toContain("Nota de cobro");
    expect(container.textContent).toContain("Promo de temporada");
    expect(container.textContent).toContain("Alergia al amoniaco");
    expect(onClose).not.toHaveBeenCalled();
    mounted?.unmount();
    mounted = null;

    const plain = render();
    expect(plain.container.textContent).not.toContain("Nota de cobro");
    expect(plain.container.textContent).not.toContain("Notas");
  });

  it("ofrece editar y reprogramar solo a quien gestiona una cita abierta", () => {
    const { container } = render();
    expect(container.querySelector<HTMLAnchorElement>('a[href="/appointments/appt-1/edit"]')?.textContent).toContain(
      "Editar / reprogramar"
    );
    mounted?.unmount();
    mounted = null;

    const readOnly = render({ canManage: false });
    expect(readOnly.container.querySelector('a[href="/appointments/appt-1/edit"]')).toBeNull();
    expect(readOnly.container.textContent).not.toContain("Confirmar");
    expect(readOnly.container.textContent).not.toContain("Completar");
  });

  it("no ofrece edición ni acciones rápidas en una cita ya cerrada", () => {
    const { container } = render({ appt: buildDetail({ status: "completed" }) });

    expect(container.querySelector('a[href="/appointments/appt-1/edit"]')).toBeNull();
    expect(container.textContent).not.toContain("Cancelar cita");
    expect(container.textContent).toContain("Completada");
  });

  it("confirma una cita agendada, avisa, refresca la agenda y cierra el detalle", async () => {
    vi.mocked(confirmAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const { container, onClose } = render();

    await clickAndSettle(buttonWithText(container, "Confirmar"));
    await settleSubmission();

    expect(confirmAppointmentAction).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(confirmAppointmentAction).mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData?.get("appointment_id")).toBe("appt-1");
    expect(String(formData?.get("idempotency_key"))).toMatch(/^[0-9a-f-]{36}$/);
    expect(toastApi.success).toHaveBeenCalledWith("Cita confirmada.");
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("muestra el error de confirmación y mantiene el detalle abierto", async () => {
    vi.mocked(confirmAppointmentAction).mockResolvedValue({ ok: false, error: "La cita ya no está disponible." });
    const { container, onClose } = render();

    await clickAndSettle(buttonWithText(container, "Confirmar"));

    expect(toastApi.error).toHaveBeenCalledWith("La cita ya no está disponible.");
    expect(toastApi.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("no ofrece confirmar una cita que ya está confirmada", () => {
    const { container } = render({ appt: buildDetail({ status: "confirmed" }) });

    expect(container.textContent).not.toContain("Confirmar");
    expect(container.textContent).toContain("Confirmada");
  });

  it("entrega el cobro y la cancelación al padre, que cierra este detalle", () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { container } = render({ onComplete, onCancel });

    click(buttonWithText(container, "Completar"));
    click(buttonWithText(container, "Cancelar cita"));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("no muestra los botones de cobro y cancelación si el padre no los entrega", () => {
    const { container } = render();

    expect(container.textContent).not.toContain("Completar");
    expect(container.textContent).not.toContain("Cancelar cita");
  });

  it("cierra el diálogo con el botón de cerrar", () => {
    const { container, onClose } = render();

    click(container.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
