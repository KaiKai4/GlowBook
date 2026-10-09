// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MESSAGE_TEMPLATES, type MessageTemplate } from "@/features/notifications/domain/templates";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, findButtonByText, flushAsync, requireElement, setFieldValue, submitFormAsync } from "@/test/ui-shared-dom";
import { updateNotificationTemplateAction } from "./actions";
import { TemplatesManager } from "./templates-manager";

vi.mock("./actions", () => ({
  updateNotificationTemplateAction: vi.fn(),
}));

const updateMock = vi.mocked(updateNotificationTemplateAction);

const TEMPLATES: MessageTemplate[] = [
  {
    event: "appointment_reminder",
    body_text: "Hola {cliente}, tu cita es el {fecha} a las {hora} en {salon}.",
    is_active: true,
  } as MessageTemplate,
  {
    event: "appointment_cancelled",
    body_text: "",
    is_active: false,
  } as MessageTemplate,
];

function bodyTextarea(card: HTMLElement): HTMLTextAreaElement {
  return requireElement<HTMLTextAreaElement>(card, 'textarea[name="body_text"]');
}

function cardFor(container: HTMLElement, title: string): HTMLElement {
  const heading = Array.from(container.querySelectorAll("h3")).find((node) => node.textContent === title);
  const card = heading?.closest<HTMLElement>("div.overflow-hidden");
  if (!card) throw new Error(`Falta la tarjeta ${title}`);
  return card;
}

describe("TemplatesManager", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    updateMock.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("muestra una tarjeta por plantilla con su título y descripción", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);

    expect(cardFor(mounted.container, "Recordatorio de cita").textContent).toContain("botón de WhatsApp");
    expect(cardFor(mounted.container, "Cancelación de cita").textContent).toContain("cancelas una cita");
  });

  it("la vista previa reemplaza las variables por datos de ejemplo", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);

    const preview = cardFor(mounted.container, "Recordatorio de cita").querySelector<HTMLElement>(".whitespace-pre-line");
    expect(preview?.textContent).toBe("Hola María González, tu cita es el martes 26 de mayo a las 2:30 p. m. en WavyHair.");
  });

  it("escribir en el mensaje actualiza la vista previa en vivo", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);
    const card = cardFor(mounted.container, "Recordatorio de cita");

    setFieldValue(bodyTextarea(card), "Te esperamos {cliente}");

    expect(card.querySelector(".whitespace-pre-line")?.textContent).toBe("Te esperamos María González");
  });

  it("una plantilla sin texto guardado usa el mensaje base por defecto", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);

    const card = cardFor(mounted.container, "Cancelación de cita");
    expect(bodyTextarea(card).value).toBe(DEFAULT_MESSAGE_TEMPLATES.appointment_cancelled.body_text);
  });

  it("mientras la plantilla personalizada está desactivada se explica que se usará el mensaje base", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);
    // La plantilla de cancelación llega desactivada: el aviso aparece desde el inicio.
    const card = cardFor(mounted.container, "Cancelación de cita");
    expect(requireElement<HTMLInputElement>(card, 'input[name="is_active"]').checked).toBe(false);
    expect(card.textContent).toContain("Si la desactivas, el sistema usará el mensaje base");

    clickElement(requireElement<HTMLInputElement>(card, 'input[name="is_active"]'));

    expect(requireElement<HTMLInputElement>(card, 'input[name="is_active"]').checked).toBe(true);
    expect(card.textContent).not.toContain("Si la desactivas");
  });

  it("muestra las variables disponibles como códigos", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);

    const codes = Array.from(cardFor(mounted.container, "Recordatorio de cita").querySelectorAll("code")).map(
      (code) => code.textContent
    );
    expect(codes).toContain("{cliente}");
    expect(codes).toContain("{salon}");
  });

  it("guardar envía el evento y el texto, y muestra confirmación", async () => {
    updateMock.mockResolvedValue({ ok: true, value: undefined });
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);
    const card = cardFor(mounted.container, "Recordatorio de cita");

    setFieldValue(bodyTextarea(card), "Hola {cliente}");
    await submitFormAsync(requireElement<HTMLFormElement>(card, "form"));
    await flushAsync();

    expect(updateMock).toHaveBeenCalledTimes(1);
    const formData = updateMock.mock.calls[0]?.[1];
    expect(formData?.get("event")).toBe("appointment_reminder");
    expect(formData?.get("body_text")).toBe("Hola {cliente}");
    expect(card.textContent).toContain("Plantilla guardada.");
  });

  it("si guardar falla muestra el error devuelto por la acción", async () => {
    updateMock.mockResolvedValue({ ok: false, error: "El mensaje no puede estar vacío" });
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);
    const card = cardFor(mounted.container, "Recordatorio de cita");

    await submitFormAsync(requireElement<HTMLFormElement>(card, "form"));
    await flushAsync();

    expect(card.textContent).toContain("El mensaje no puede estar vacío");
    expect(card.textContent).not.toContain("Plantilla guardada.");
  });

  it("el botón Guardar plantilla es de tipo submit", () => {
    mounted = mountComponent(<TemplatesManager templates={TEMPLATES} />);

    expect(findButtonByText(cardFor(mounted.container, "Recordatorio de cita"), "Guardar plantilla").type).toBe("submit");
  });
});
