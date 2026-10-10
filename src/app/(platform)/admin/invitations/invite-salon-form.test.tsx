// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toast,
}));
import { err, ok } from "@/infra/result";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { clickElement, getButtonByText, getFieldByName, changeFieldValue } from "@/test/ui-admin-dom";
import { inviteSalonAction } from "../actions";
import { InviteSalonForm } from "./invite-salon-form";
import { SAVED_WITH_WARNINGS_MESSAGE } from "@/components/forms/use-submission-intent";
import { UUID_PATTERN, settleSubmission } from "@/test/form-intent-dom";

vi.mock("../actions", () => ({ inviteSalonAction: vi.fn() }));

const PLANS = [
  { id: "plan-pro", name: "Pro", priceLabel: "$30", trialDays: 14 },
  { id: "plan-basico", name: "Básico", priceLabel: "$12", trialDays: 0 },
];

describe("InviteSalonForm envío con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(inviteSalonAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("envía idempotency_key y la mantiene al reintentar tras un error", async () => {
    vi.mocked(inviteSalonAction)
      .mockResolvedValueOnce(err("El correo ya tiene una invitación"))
      .mockResolvedValueOnce(ok("tok-123"));
    mounted = mountComponent(<InviteSalonForm plans={PLANS} />);
    const email = "duena@salon.test";

    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "email"), email);
    clickElement(getButtonByText(mounted.container, "Invitar"));
    await settleSubmission();
    // Tras la acción React reinicia los campos del formulario: se vuelve a escribir el mismo correo.
    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "email"), email);
    clickElement(getButtonByText(mounted.container, "Invitar"));
    await settleSubmission();

    const calls = vi.mocked(inviteSalonAction).mock.calls;
    expect(calls).toHaveLength(2);
    const firstKey = String(calls[0]?.[1].get("idempotency_key"));
    expect(firstKey).toMatch(UUID_PATTERN);
    expect(String(calls[1]?.[1].get("idempotency_key"))).toBe(firstKey);
  });

  it("avisa cuando la invitación se creó pero un efecto posterior falló", async () => {
    vi.mocked(inviteSalonAction).mockResolvedValueOnce({
      ok: true,
      value: "tok-123",
      warnings: ["No se envió el correo de bienvenida."],
    } as Awaited<ReturnType<typeof inviteSalonAction>>);
    mounted = mountComponent(<InviteSalonForm plans={PLANS} />);

    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "email"), "owner@salon.test");
    clickElement(getButtonByText(mounted.container, "Invitar"));
    await settleSubmission();

    expect(toast.warning).toHaveBeenCalledWith(SAVED_WITH_WARNINGS_MESSAGE);
  });
});

describe("InviteSalonForm", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(inviteSalonAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("muestra el correo del owner y el plan inicial como primera opción del salón", () => {
    mounted = mountComponent(<InviteSalonForm plans={PLANS} />);

    const emailInput = mounted.container.querySelector<HTMLInputElement>("#invite-email");
    expect(emailInput?.type).toBe("email");
    expect(emailInput?.required).toBe(true);
    expect(mounted.container.textContent).toContain("Correo del owner");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "planId").value).toBe("plan-pro");
    expect(mounted.container.textContent).toContain("Pro — $30 · 14d trial");
  });

  it("envía el correo y el plan seleccionados a la acción de invitación", async () => {
    vi.mocked(inviteSalonAction).mockResolvedValue(ok("tok-123"));
    mounted = mountComponent(<InviteSalonForm plans={PLANS} />);

    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "email"), "duena@salon.test");
    clickElement(getButtonByText(mounted.container, "Invitar"));
    await settleSubmission();

    expect(inviteSalonAction).toHaveBeenCalledTimes(1);
    const [, formData] = vi.mocked(inviteSalonAction).mock.calls[0]!;
    expect(formData.get("email")).toBe("duena@salon.test");
    expect(formData.get("planId")).toBe("plan-pro");
  });

  it("muestra el enlace generado para copiarlo tras una invitación correcta", async () => {
    vi.mocked(inviteSalonAction).mockResolvedValue(ok("tok-123"));
    mounted = mountComponent(<InviteSalonForm plans={PLANS} />);

    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "email"), "owner@salon.test");
    clickElement(getButtonByText(mounted.container, "Invitar"));
    await settleSubmission();

    expect(mounted.container.querySelector("code")?.textContent).toBe(
      `${window.location.origin}/invite/tok-123`
    );
  });

  it("muestra el error de validación devuelto por la acción sin revelar enlace", async () => {
    vi.mocked(inviteSalonAction).mockResolvedValue(err("Ya existe una invitación pendiente para ese correo."));
    mounted = mountComponent(<InviteSalonForm plans={PLANS} />);

    changeFieldValue(getFieldByName<HTMLInputElement>(mounted.container, "email"), "owner@salon.test");
    clickElement(getButtonByText(mounted.container, "Invitar"));
    await settleSubmission();

    expect(mounted.container.textContent).toContain("Ya existe una invitación pendiente para ese correo.");
    expect(mounted.container.querySelector("code")).toBeNull();
  });

  it("explica que el salón nace con el plan elegido", () => {
    mounted = mountComponent(<InviteSalonForm plans={[]} />);

    expect(mounted.container.textContent).toContain("Al aceptar la invitación, el salón nace con este plan");
    expect(getFieldByName<HTMLInputElement>(mounted.container, "planId").value).toBe("");
  });
});
