// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { cancelAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import {
  deleteTemporaryCustomerAction,
  promoteCustomerAction,
} from "@/app/(dashboard)/customers/actions";
import { formatTimeTz } from "@/lib/utils/dates";
import { ToastProvider } from "@/components/ui/toast";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { SALON_TZ } from "@/test/ui-appointments-fixtures";
import { buttonContainingText, buttonWithText, clickAndSettle, click } from "@/test/ui-appointments-dom";
import { flushAsync } from "@/test/ui-shared-dom";
import { CancelAppointmentDialog } from "./cancel-appointment";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  cancelAppointmentAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/customers/actions", () => ({
  promoteCustomerAction: vi.fn(),
  deleteTemporaryCustomerAction: vi.fn(),
}));

type CancelAppt = Parameters<typeof CancelAppointmentDialog>[0]["appt"];

// La clave de idempotencia se calcula con SHA-256 asíncrono antes de llamar a la acción:
// hay que dejar correr varias tareas pendientes antes de comprobar el resultado.
async function clickAndFlush(element: Element): Promise<void> {
  await clickAndSettle(element);
  for (let i = 0; i < 5; i += 1) await flushAsync();
}

const START = "2026-10-12T14:00:00-05:00";
const TEMPLATE =
  "Hola {cliente}, tu cita de {servicios} con {colaboradores} en {salon} es el {fecha} a las {hora}.";

function buildAppt(overrides: Partial<CancelAppt> = {}): CancelAppt {
  return {
    id: "appt-1",
    start_time: START,
    customer: {
      id: "cust-1",
      first_name: "Ana",
      last_name: "Pérez",
      phone: "61234567",
      is_temporary: false,
    },
    items: [
      {
        service: { name: "Corte" },
        employee: { first_name: "Lucía", last_name: "Gómez" },
      },
      {
        service: { name: "Tinte" },
        employee: { first_name: "Marta", last_name: "Ruiz" },
      },
      {
        service: { name: "Peinado" },
        employee: { first_name: "Lucía", last_name: "Gómez" },
      },
    ],
    ...overrides,
  };
}

const TEMP_CUSTOMER: NonNullable<CancelAppt["customer"]> = {
  id: "cust-temp",
  first_name: "Luis",
  last_name: "Soto",
  phone: null,
  is_temporary: true,
};

describe("CancelAppointmentDialog con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(cancelAppointmentAction).mockReset();
    vi.mocked(promoteCustomerAction).mockReset();
    vi.mocked(deleteTemporaryCustomerAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  function mountCancel(onClose = vi.fn()): MountedComponent {
    return mountComponent(
      <ToastProvider>
        <CancelAppointmentDialog
          appt={buildAppt()}
          open
          onClose={onClose}
          tz={SALON_TZ}
          salonName="Salón Prueba"
          template={TEMPLATE}
        />
      </ToastProvider>
    );
  }

  it("envía idempotency_key y la mantiene al reintentar tras un error", async () => {
    vi.mocked(cancelAppointmentAction)
      .mockResolvedValueOnce({ ok: false, error: "La cita ya fue completada." })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    mounted = mountCancel();

    await clickAndFlush(buttonWithText(mounted.container, "Cancelar cita"));
    await clickAndFlush(buttonWithText(mounted.container, "Cancelar cita"));

    const calls = vi.mocked(cancelAppointmentAction).mock.calls;
    expect(calls).toHaveLength(2);
    const firstKey = String(calls[0]?.[0].get("idempotency_key"));
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(String(calls[1]?.[0].get("idempotency_key"))).toBe(firstKey);
  });

  it("no se puede cerrar con Escape, la X ni Volver mientras la cancelación está en curso", async () => {
    let release: (value: Awaited<ReturnType<typeof cancelAppointmentAction>>) => void = () => {};
    vi.mocked(cancelAppointmentAction).mockReturnValue(
      new Promise((done) => {
        release = done;
      })
    );
    const onClose = vi.fn();
    mounted = mountCancel(onClose);

    await clickAndFlush(buttonWithText(mounted.container, "Cancelar cita"));
    expect(cancelAppointmentAction).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    const closeButton = mounted.container.querySelector<HTMLButtonElement>("button[aria-label='Cerrar']");
    expect(closeButton?.disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      release({ ok: true, value: undefined });
    });
    for (let i = 0; i < 5; i += 1) await flushAsync();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CancelAppointmentDialog", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    router.refresh.mockReset();
    vi.mocked(cancelAppointmentAction).mockReset();
    vi.mocked(promoteCustomerAction).mockReset();
    vi.mocked(deleteTemporaryCustomerAction).mockReset();
    vi.mocked(promoteCustomerAction).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(deleteTemporaryCustomerAction).mockResolvedValue({ ok: true, value: undefined });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.restoreAllMocks();
  });

  function render(props: Partial<Parameters<typeof CancelAppointmentDialog>[0]> = {}) {
    const onClose = vi.fn();
    mounted = mountComponent(
      <ToastProvider>
        <CancelAppointmentDialog
          appt={buildAppt()}
          open
          onClose={onClose}
          tz={SALON_TZ}
          salonName="Salón Prueba"
          template={TEMPLATE}
          {...props}
        />
      </ToastProvider>
    );
    return { container: mounted.container, onClose };
  }

  it("pide confirmación nombrando al cliente de la cita", () => {
    const { container } = render();

    expect(container.querySelector("h2")?.textContent).toBe("Cancelar cita");
    expect(container.textContent).toContain("Confirma la cancelación de la cita de Ana Pérez.");
  });

  it("habla del cliente genérico cuando la cita no tiene cliente", () => {
    const { container } = render({ appt: buildAppt({ customer: null }) });

    expect(container.textContent).toContain("Confirma la cancelación de la cita de el cliente.");
    expect(container.textContent).not.toContain("Cancelar y notificar por WhatsApp");
  });

  it("no pregunta por el destino de los datos a un cliente permanente", () => {
    const { container } = render();

    expect(container.textContent).not.toContain("¿Guardar los datos del cliente?");
  });

  it("para un cliente temporal propone descartar sus datos por defecto y permite guardarlos", () => {
    const { container } = render({ appt: buildAppt({ customer: TEMP_CUSTOMER }) });

    expect(container.textContent).toContain("¿Guardar los datos del cliente?");
    const discard = buttonContainingText(container, "No, descartar datos");
    const save = buttonContainingText(container, "Sí, guardar cliente");
    expect(discard.className).toContain("border-warning");
    expect(save.className).not.toContain("border-brand-400");

    click(save);

    expect(save.className).toContain("border-brand-400");
    expect(discard.className).not.toContain("border-warning");
  });

  it("ofrece notificar por WhatsApp solo si el cliente tiene teléfono", () => {
    const { container } = render();
    expect(buttonWithText(container, "Cancelar y notificar por WhatsApp")).toBeInstanceOf(HTMLButtonElement);
    mounted?.unmount();
    mounted = null;

    const noPhone = render({
      appt: buildAppt({ customer: { ...TEMP_CUSTOMER, phone: null, is_temporary: false } }),
    });
    expect(noPhone.container.textContent).not.toContain("Cancelar y notificar por WhatsApp");
  });

  it("'Volver' cierra el diálogo sin cancelar la cita", () => {
    const { container, onClose } = render();

    click(buttonWithText(container, "Volver"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancelAppointmentAction).not.toHaveBeenCalled();
  });

  it("cancela la cita de un cliente permanente sin tocar sus datos", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const { container, onClose } = render();

    await clickAndFlush(buttonWithText(container, "Cancelar cita"));

    expect(cancelAppointmentAction).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(cancelAppointmentAction).mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData?.get("appointment_id")).toBe("appt-1");
    expect(String(formData?.get("idempotency_key"))).toMatch(/^[0-9a-f-]{36}$/);
    expect(promoteCustomerAction).not.toHaveBeenCalled();
    expect(deleteTemporaryCustomerAction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("guarda el cliente temporal si se elige guardarlo al cancelar", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const { container } = render({ appt: buildAppt({ customer: TEMP_CUSTOMER }) });

    click(buttonContainingText(container, "Sí, guardar cliente"));
    await clickAndFlush(buttonWithText(container, "Cancelar cita"));

    expect(promoteCustomerAction).toHaveBeenCalledWith("cust-temp");
    expect(deleteTemporaryCustomerAction).not.toHaveBeenCalled();
  });

  it("descarta el cliente temporal al cancelar cuando se elige descartar", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const { container } = render({ appt: buildAppt({ customer: TEMP_CUSTOMER }) });

    await clickAndFlush(buttonWithText(container, "Cancelar cita"));

    expect(deleteTemporaryCustomerAction).toHaveBeenCalledWith("cust-temp");
    expect(promoteCustomerAction).not.toHaveBeenCalled();
  });

  it("muestra el error de cancelación, no cierra y no toca al cliente", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: false, error: "La cita ya fue completada." });
    const { container, onClose } = render({ appt: buildAppt({ customer: TEMP_CUSTOMER }) });

    await clickAndFlush(buttonWithText(container, "Cancelar cita"));

    expect(container.textContent).toContain("La cita ya fue completada.");
    expect(onClose).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(promoteCustomerAction).not.toHaveBeenCalled();
    expect(deleteTemporaryCustomerAction).not.toHaveBeenCalled();
  });

  it("si falla descartar al cliente temporal, avisa y no cierra en silencio", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(deleteTemporaryCustomerAction).mockResolvedValue({ ok: false, error: "No se pudo borrar." });
    const { container, onClose } = render({ appt: buildAppt({ customer: TEMP_CUSTOMER }) });

    await clickAndFlush(buttonWithText(container, "Cancelar cita"));

    expect(onClose).not.toHaveBeenCalled();
    expect(container.textContent).toContain("no pudimos descartar los datos temporales del cliente");
    expect(container.textContent).toContain("No se pudo borrar.");
  });

  it("notifica por WhatsApp con el mensaje renderizado de la plantilla y el teléfono en dígitos", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container, onClose } = render();

    await clickAndFlush(buttonWithText(container, "Cancelar y notificar por WhatsApp"));

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target] = open.mock.calls[0] ?? [];
    expect(target).toBe("_blank");
    expect(String(url).startsWith("https://wa.me/61234567?text=")).toBe(true);
    const message = decodeURIComponent(String(url).split("?text=")[1] ?? "");
    expect(message).toContain("Hola Ana, tu cita de Corte, Tinte, Peinado con Lucía Gómez, Marta Ruiz en Salón Prueba");
    expect(message).toContain(`a las ${formatTimeTz(new Date(START), SALON_TZ)}.`);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("usa textos de respaldo en el WhatsApp cuando la cita no tiene servicios ni colaboradores", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render({ appt: buildAppt({ items: [] }) });

    await clickAndFlush(buttonWithText(container, "Cancelar y notificar por WhatsApp"));

    const url = String(open.mock.calls[0]?.[0]);
    const message = decodeURIComponent(url.split("?text=")[1] ?? "");
    expect(message).toContain("tu cita de Servicios de belleza con nuestro equipo");
  });

  it("no abre WhatsApp al cancelar sin notificar aunque el cliente tenga teléfono", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({ ok: true, value: undefined });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render();

    await clickAndFlush(buttonWithText(container, "Cancelar cita"));

    expect(open).not.toHaveBeenCalled();
  });
});
