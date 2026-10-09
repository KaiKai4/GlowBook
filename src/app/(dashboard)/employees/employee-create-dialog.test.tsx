// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click, fieldByName, flushAsync, setFieldValue, formOf, submitForm } from "@/test/ui-people-dom";
import { createEmployeeAction } from "./actions";
import { EmployeeCreateDialog } from "./employee-create-dialog";
import type { CategoryOption, RoleOption } from "./types";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("./actions", () => ({
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
    expect(document.body.textContent).toContain("Enlace de acceso valido 7 días");
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
