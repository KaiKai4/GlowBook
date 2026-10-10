// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { completeAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { formatCurrency } from "@/infra/format/money";
import { ToastProvider } from "@/components/ui/toast";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { flushAsync } from "@/test/ui-shared-dom";
import { PAYMENT_OPTIONS } from "@/test/ui-appointments-fixtures";
import {
  buttonWithText,
  chooseOption,
  clickAndSettle,
  click,
  setFieldValue,
} from "@/test/ui-appointments-dom";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";
import { CompleteAppointmentDialog, type AppointmentForCompletion } from "./complete-appointment";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const confetti = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("canvas-confetti", () => ({ default: confetti }));
vi.mock("@/app/(dashboard)/appointments/actions", () => ({
  completeAppointmentAction: vi.fn(),
}));

const APPT: AppointmentForCompletion = {
  id: "appt-1",
  total_price: 55,
  customer: { first_name: "Ana", last_name: "Pérez" },
  items: [
    {
      id: "item-1",
      price: 40,
      discount_amount: 0,
      service: {
        name: "Tinte",
        category: { name: "Cabello", pricing_mode: "variable" },
      },
    },
    {
      id: "item-2",
      price: 15,
      discount_amount: 0,
      service: {
        name: "Manicura",
        category: { name: "Uñas", pricing_mode: "fixed" },
      },
    },
  ],
};

/** Campos numéricos en orden: precio y descuento de cada servicio. */
function numberFields(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="number"]'));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Resultado de la RPC: el total del servidor (999) no coincide con ninguna vista previa local.
const SERVER_RESULT = {
  appointment_id: "appt-1",
  status: "completed" as const,
  subtotal: 999,
  discount_amount: 0,
  total_price: 999,
};

describe("CompleteAppointmentDialog con cobro en curso", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(completeAppointmentAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("no se puede cerrar con Escape ni la X mientras el cobro está en curso", async () => {
    let release: (value: Awaited<ReturnType<typeof completeAppointmentAction>>) => void = () => {};
    vi.mocked(completeAppointmentAction).mockReturnValue(
      new Promise((done) => {
        release = done;
      })
    );
    const onClose = vi.fn();
    mounted = mountComponent(
      <ToastProvider>
        <CompleteAppointmentDialog
          appt={APPT}
          open
          onClose={onClose}
          paymentMethodOptions={PAYMENT_OPTIONS}
        />
      </ToastProvider>
    );

    click(buttonWithText(mounted.container, "Cobrar y completar"));
    for (let i = 0; i < 5; i += 1) await flushAsync();
    expect(completeAppointmentAction).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    const closeButton = mounted.container.querySelector<HTMLButtonElement>("button[aria-label='Cerrar']");
    expect(closeButton?.disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      release({ ok: false, error: "La cita ya está cerrada." });
    });
    for (let i = 0; i < 5; i += 1) await flushAsync();
  });
});

describe("CompleteAppointmentDialog", () => {
  let mounted: MountedComponent | null = null;
  let matchMediaDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    router.refresh.mockReset();
    confetti.mockReset();
    vi.mocked(completeAppointmentAction).mockReset();
    matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    if (matchMediaDescriptor) {
      Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
    vi.useRealTimers();
  });

  function render(
    props: { appt?: AppointmentForCompletion; paymentMethodOptions?: PaymentMethodOption[] } = {}
  ) {
    const onClose = vi.fn();
    mounted = mountComponent(
      <ToastProvider>
        <CompleteAppointmentDialog
          appt={props.appt ?? APPT}
          open
          onClose={onClose}
          paymentMethodOptions={props.paymentMethodOptions ?? PAYMENT_OPTIONS}
        />
      </ToastProvider>
    );
    return { container: mounted.container, onClose };
  }

  it("muestra el total cobrado inicial como suma de los precios de los servicios", () => {
    const { container } = render();

    expect(container.querySelector("h2")?.textContent).toBe("Completar cita");
    expect(container.textContent).toContain(formatCurrency(55));
    expect(container.textContent).not.toContain("Descuento aplicado");
  });

  it("solo permite editar el precio de los servicios de precio variable", () => {
    const { container } = render();

    const [variablePrice, variableDiscount, fixedPrice] = numberFields(container);
    expect(variablePrice?.disabled).toBe(false);
    expect(variableDiscount?.disabled).toBe(false);
    expect(fixedPrice?.disabled).toBe(true);
  });

  it("aplica un descuento por servicio y recalcula el total cobrado", () => {
    const { container } = render();

    setFieldValue(numberFields(container)[1]!, "10");

    expect(container.textContent).toContain("Promocion aplicada solo a este servicio");
    expect(container.textContent).toContain(`-${formatCurrency(4)} = ${formatCurrency(36)}`);
    expect(container.textContent).toContain(`Descuento aplicado: ${formatCurrency(4)}`);
    expect(container.textContent).toContain(formatCurrency(51));
  });

  it("limita el descuento al rango 0-100% sin dejar el total cobrado negativo", () => {
    const { container } = render();

    setFieldValue(numberFields(container)[1]!, "250");

    expect(container.textContent).toContain(formatCurrency(0));
    expect(container.textContent).toContain(`-${formatCurrency(40)}`);
  });

  it("recalcula con el precio editado de un servicio variable", () => {
    const { container } = render();

    setFieldValue(numberFields(container)[0]!, "60");

    expect(container.textContent).toContain(formatCurrency(75));
  });

  it("cobra con el método de pago elegido y envía los cargos por servicio", async () => {
    vi.mocked(completeAppointmentAction).mockResolvedValue({ ok: true, value: SERVER_RESULT });
    const { container } = render();

    chooseOption(container, "Método de pago", "Tarjeta");
    setFieldValue(numberFields(container)[1]!, "10");
    setFieldValue(container.querySelector("textarea")!, "Promo de temporada");
    await clickAndSettle(buttonWithText(container, "Cobrar y completar"));
    await flushAsync();

    expect(completeAppointmentAction).toHaveBeenCalledTimes(1);
    const [prevState, formData] = vi.mocked(completeAppointmentAction).mock.calls[0] ?? [];
    expect(prevState).toBeNull();
    expect(formData).toBeInstanceOf(FormData);
    expect(formData?.get("appointment_id")).toBe("appt-1");
    expect(formData?.get("payment_method")).toBe("card");
    expect(formData?.get("completion_price_note")).toBe("Promo de temporada");
    expect(JSON.parse(String(formData?.get("item_charges")))).toEqual([
      { id: "item-1", price: 40, discountPercentage: 10 },
      { id: "item-2", price: 15, discountPercentage: 0 },
    ]);
  });

  it("usa el primer método de pago disponible por defecto", async () => {
    vi.mocked(completeAppointmentAction).mockResolvedValue({ ok: true, value: SERVER_RESULT });
    const { container } = render({
      paymentMethodOptions: [
        { value: "transfer", label: "Transferencia" },
        { value: "cash", label: "Efectivo" },
      ],
    });

    await clickAndSettle(buttonWithText(container, "Cobrar y completar"));
    await flushAsync();

    expect(vi.mocked(completeAppointmentAction).mock.calls[0]?.[1]?.get("payment_method")).toBe("transfer");
  });

  it("limita la nota de cobro a 500 caracteres", () => {
    const { container } = render();

    expect(container.querySelector("textarea")?.maxLength).toBe(500);
  });

  it("muestra el error de la acción, no marca la cita como completada y no cierra", async () => {
    vi.mocked(completeAppointmentAction).mockResolvedValue({ ok: false, error: "La cita ya está cerrada." });
    const { container, onClose } = render();

    await clickAndSettle(buttonWithText(container, "Cobrar y completar"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(container.textContent).toContain("La cita ya está cerrada.");
    expect(buttonWithText(container, "Cobrar y completar").disabled).toBe(false);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("al completar con éxito marca la cita, refresca la agenda, lanza confeti y cierra el diálogo", async () => {
    vi.mocked(completeAppointmentAction).mockResolvedValue({ ok: true, value: SERVER_RESULT });
    const { container, onClose } = render();

    await clickAndSettle(buttonWithText(container, "Cobrar y completar"));

    expect(buttonWithText(container, "Cita completada").disabled).toBe(true);
    // Tras completar muestra el total final que devuelve el servidor, no la vista previa.
    expect(container.textContent).toContain(formatCurrency(999));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(confetti.mock.calls[0]?.[0]).toMatchObject({ particleCount: 90, disableForReducedMotion: true });

    // El diálogo se cierra 700 ms después del éxito.
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 760));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no lanza confeti si el usuario prefiere movimiento reducido", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    vi.mocked(completeAppointmentAction).mockResolvedValue({ ok: true, value: SERVER_RESULT });
    const { container } = render();

    await clickAndSettle(buttonWithText(container, "Cobrar y completar"));

    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(confetti).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("no envía un segundo cobro mientras el primero está en curso", async () => {
    const pending = deferred<{ ok: true; value: typeof SERVER_RESULT }>();
    vi.mocked(completeAppointmentAction).mockReturnValue(pending.promise);
    const { container } = render();

    click(buttonWithText(container, "Cobrar y completar"));
    click(buttonWithText(container, "Cobrar y completar"));
    await flushAsync();

    expect(completeAppointmentAction).toHaveBeenCalledTimes(1);
    expect(buttonWithText(container, "Cancelar").disabled).toBe(true);

    await act(async () => {
      pending.resolve({ ok: true, value: SERVER_RESULT });
    });
  });

  it("'Cancelar' cierra el diálogo sin cobrar", () => {
    const { container, onClose } = render();

    click(buttonWithText(container, "Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(completeAppointmentAction).not.toHaveBeenCalled();
  });
});
