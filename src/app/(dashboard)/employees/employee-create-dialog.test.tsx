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
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, fieldByName, flushAsync, setFieldValue, formOf, submitForm } from "@/test/ui-people-dom";
import { createEmployeeAction } from "./actions-profile";
import { EmployeeCreateDialog } from "./employee-create-dialog";
import type { CategoryOption, RoleOption } from "./types";
import { act } from "react";
import { settleSubmission } from "@/test/form-intent-dom";

describe("EmployeeCreateDialog con alta en curso", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("no se puede cerrar con Escape, la X ni Cancelar mientras la alta está en curso", async () => {
    let release: (value: Awaited<ReturnType<typeof createEmployeeAction>>) => void = () => {};
    vi.mocked(createEmployeeAction).mockReturnValue(
      new Promise((done) => {
        release = done;
      })
    );
    const onOpenChange = vi.fn();
    mounted = renderDialog(true, onOpenChange);
    setFieldValue(fieldByName(mounted.container, "first_name"), "Marta");
    setFieldValue(fieldByName(mounted.container, "last_name"), "Lima");

    await submitForm(formOf(mounted.container));
    await settleSubmission();
    expect(createEmployeeAction).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    const closeButton = mounted.container.querySelector<HTMLButtonElement>("button[aria-label='Cerrar']");
    expect(closeButton?.disabled).toBe(true);
    expect(buttonWithText(mounted.container, "Cancelar").disabled).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => {
      release({ ok: true, value: { id: "emp-new" } });
    });
    await settleSubmission();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("./actions-profile", () => ({
  createEmployeeAction: vi.fn(),
  findArchivedEmployeeByEmailAction: vi.fn(),
  reactivateEmployeeAction: vi.fn(),
}));

const CATEGORIES: CategoryOption[] = [
  { id: "cat-cabello", name: "Cabello", services: [{ id: "svc-corte", name: "Corte" }] },
];
const ROLES: RoleOption[] = [{ id: "role-estilista", name: "Estilista" }];

function renderDialog(open: boolean, onOpenChange = vi.fn()): MountedComponent {
  return mountComponent(
    <EmployeeCreateDialog open={open} onOpenChange={onOpenChange} categories={CATEGORIES} roles={ROLES} />
  );
}

function dialogTitle(): string | null {
  return document.body.querySelector('[role="dialog"] h2')?.textContent ?? null;
}

describe("EmployeeCreateDialog", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(createEmployeeAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("no muestra nada cuando está cerrado", () => {
    mounted = renderDialog(false);

    expect(dialogTitle()).toBeNull();
  });

  it("muestra el formulario de alta con su descripción cuando está abierto", () => {
    mounted = renderDialog(true);

    expect(dialogTitle()).toBe("Nuevo colaborador");
    expect(document.body.textContent).toContain("Elige las categorías y los servicios que realiza.");
    expect(fieldByName(document.body, "first_name").required).toBe(true);
  });

  it("cierra el diálogo al cancelar", () => {
    const onOpenChange = vi.fn();
    mounted = renderDialog(true, onOpenChange);

    click(buttonWithText(document.body, "Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("tras crear un colaborador con invitación muestra el enlace de acceso con el origen actual", async () => {
    vi.mocked(createEmployeeAction).mockResolvedValue({
      ok: true,
      value: { id: "emp-new", inviteToken: "tok-abc123", inviteExpiresAt: "2026-10-16T00:00:00.000Z" },
    });
    const onOpenChange = vi.fn();
    mounted = renderDialog(true, onOpenChange);

    setFieldValue(fieldByName(document.body, "first_name"), "Marta");
    setFieldValue(fieldByName(document.body, "last_name"), "Lima");
    await submitForm(formOf(document.body));
    await flushAsync();

    expect(dialogTitle()).toBe("Colaborador creado");
    const input = document.body.querySelector<HTMLInputElement>('input[aria-label="Enlace de invitación"]');
    expect(input?.value).toBe(`${window.location.origin}/join/tok-abc123`);
    expect(document.body.textContent).toContain("Enlace de acceso válido 7 días");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cierra el diálogo al terminar desde la pantalla de enlace generado", async () => {
    vi.mocked(createEmployeeAction).mockResolvedValue({
      ok: true,
      value: { id: "emp-new", inviteToken: "tok-abc123" },
    });
    const onOpenChange = vi.fn();
    mounted = renderDialog(true, onOpenChange);

    setFieldValue(fieldByName(document.body, "first_name"), "Marta");
    setFieldValue(fieldByName(document.body, "last_name"), "Lima");
    await submitForm(formOf(document.body));
    await flushAsync();
    click(buttonWithText(document.body, "Listo"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cierra directamente cuando la alta no genera enlace de invitación", async () => {
    vi.mocked(createEmployeeAction).mockResolvedValue({ ok: true, value: { id: "emp-new" } });
    const onOpenChange = vi.fn();
    mounted = renderDialog(true, onOpenChange);

    setFieldValue(fieldByName(document.body, "first_name"), "Marta");
    setFieldValue(fieldByName(document.body, "last_name"), "Lima");
    await submitForm(formOf(document.body));
    await flushAsync();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(dialogTitle()).toBe("Nuevo colaborador");
  });
});
