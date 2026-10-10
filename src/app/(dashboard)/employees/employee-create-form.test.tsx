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
import {
  blur,
  buttonWithText,
  click,
  fieldByLabel,
  fieldByName,
  flushAsync,
  formOf,
  setFieldValue,
  submitForm,
} from "@/test/ui-people-dom";
import {
  createEmployeeAction,
  findArchivedEmployeeByEmailAction,
  reactivateEmployeeAction,
} from "./actions";
import { EmployeeCreateForm } from "./employee-create-form";
import type { CategoryOption, RoleOption } from "./types";
import { SAVED_WITH_WARNINGS_MESSAGE } from "@/components/forms/use-submission-intent";
import { UUID_PATTERN, idempotencyKeyOf, settleSubmission } from "@/test/form-intent-dom";
import { submitFormAsync } from "@/test/ui-shared-dom";

describe("EmployeeCreateForm envío con intención idempotente", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("envía idempotency_key en el FormData y la mantiene al reintentar tras un error", async () => {
    vi.mocked(createEmployeeAction)
      .mockResolvedValueOnce({ ok: false, error: "El email ya está en uso" })
      .mockResolvedValueOnce({ ok: true, value: { id: "emp-new" } });
    mounted = renderForm();
    setFieldValue(fieldByName(mounted.container, "first_name"), "Marta");
    setFieldValue(fieldByName(mounted.container, "last_name"), "Lima");

    await submitFormAsync(formOf(mounted.container));
    await settleSubmission();
    // React reinicia los campos de un formulario con acción al terminar: se vuelven a escribir los mismos datos.
    setFieldValue(fieldByName(mounted.container, "first_name"), "Marta");
    setFieldValue(fieldByName(mounted.container, "last_name"), "Lima");
    await submitFormAsync(formOf(mounted.container));
    await settleSubmission();

    const calls = vi.mocked(createEmployeeAction).mock.calls;
    expect(calls).toHaveLength(2);
    const firstKey = idempotencyKeyOf(calls[0]?.[1]);
    expect(firstKey).toMatch(UUID_PATTERN);
    expect(idempotencyKeyOf(calls[1]?.[1])).toBe(firstKey);
  });

  it("avisa cuando el colaborador se creó pero un efecto posterior falló", async () => {
    vi.mocked(createEmployeeAction).mockResolvedValueOnce({
      ok: true,
      value: { id: "emp-new" },
      warnings: ["No se guardaron los servicios del colaborador."],
    } as Awaited<ReturnType<typeof createEmployeeAction>>);
    const onCreated = vi.fn();
    mounted = renderForm({ onCreated });

    await submitFormAsync(formOf(mounted.container));
    await settleSubmission();

    expect(toast.warning).toHaveBeenCalledWith(SAVED_WITH_WARNINGS_MESSAGE);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});

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
  {
    id: "cat-cabello",
    name: "Cabello",
    services: [
      { id: "svc-corte", name: "Corte" },
      { id: "svc-tinte", name: "Tinte" },
    ],
  },
  { id: "cat-unas", name: "Uñas", services: [{ id: "svc-manicura", name: "Manicura" }] },
];

const ROLES: RoleOption[] = [{ id: "role-estilista", name: "Estilista" }];

function renderForm(options: { roles?: RoleOption[]; onCreated?: () => void; onCreatedWithInvite?: () => void } = {}) {
  return mountComponent(
    <EmployeeCreateForm
      categories={CATEGORIES}
      roles={options.roles ?? ROLES}
      onCreated={options.onCreated ?? vi.fn()}
      onCreatedWithInvite={options.onCreatedWithInvite ?? vi.fn()}
    />
  );
}

function checkboxFor(container: HTMLElement, label: string): HTMLInputElement {
  const row = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent === label);
  const checkbox = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!checkbox) throw new Error(`No se encontró la casilla "${label}"`);
  return checkbox;
}

describe("EmployeeCreateForm", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    routerMock.refresh.mockReset();
    vi.mocked(createEmployeeAction).mockReset();
    vi.mocked(findArchivedEmployeeByEmailAction).mockReset();
    vi.mocked(findArchivedEmployeeByEmailAction).mockResolvedValue(null);
    vi.mocked(reactivateEmployeeAction).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("ofrece el selector de rol con la opción sin rol por ahora", () => {
    mounted = renderForm();

    const role = mounted.container.querySelector<HTMLInputElement>('input[name="role_id"]');
    expect(role).not.toBeNull();
    expect(mounted.container.textContent).toContain("Sin rol por ahora");
  });

  it("informa cuando el salón no tiene roles disponibles", () => {
    mounted = renderForm({ roles: [] });

    expect(mounted.container.textContent).toContain("Roles no disponibles para este salon.");
    expect(mounted.container.querySelector('input[name="role_id"]')).toBeNull();
  });

  it("envía los datos personales, la comisión y las categorías y servicios elegidos", async () => {
    vi.mocked(createEmployeeAction).mockResolvedValue({ ok: true, value: { id: "emp-new" } });
    const onCreated = vi.fn();
    mounted = renderForm({ onCreated });

    setFieldValue(fieldByName(mounted.container, "first_name"), "Marta");
    setFieldValue(fieldByName(mounted.container, "last_name"), "Lima");
    setFieldValue(fieldByName(mounted.container, "phone"), "60009999");
    setFieldValue(fieldByName(mounted.container, "commission_percentage"), "35");
    click(buttonWithText(mounted.container, "Cabello"));
    click(checkboxFor(mounted.container, "Tinte"));
    await submitForm(formOf(mounted.container));
    await flushAsync();

    await vi.waitFor(() => expect(createEmployeeAction).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(createEmployeeAction).mock.calls[0]?.[1];
    expect(formData?.get("first_name")).toBe("Marta");
    expect(formData?.get("last_name")).toBe("Lima");
    expect(formData?.get("phone")).toBe("60009999");
    expect(formData?.get("commission_percentage")).toBe("35");
    expect(formData?.getAll("category_ids")).toEqual(["cat-cabello"]);
    expect(formData?.getAll("service_ids")).toEqual(["svc-tinte"]);
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it("quita los servicios de una categoría al desmarcarla", () => {
    mounted = renderForm();

    click(buttonWithText(mounted.container, "Cabello"));
    click(checkboxFor(mounted.container, "Corte"));
    click(buttonWithText(mounted.container, "Uñas"));
    click(buttonWithText(mounted.container, "Cabello"));

    expect(mounted.container.querySelectorAll('input[name="service_ids"]')).toHaveLength(0);
    expect(mounted.container.querySelectorAll('input[name="category_ids"]')).toHaveLength(1);
  });

  it("notifica el error de la acción y no cierra el formulario", async () => {
    // La acción puede terminar después de las microtareas iniciales del envío.
    vi.mocked(createEmployeeAction).mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, error: "El email ya pertenece a otro colaborador" }), 30);
    }));
    const onCreated = vi.fn();
    mounted = renderForm({ onCreated });
    setFieldValue(fieldByName(mounted.container, "first_name"), "Marta");
    setFieldValue(fieldByName(mounted.container, "last_name"), "Lima");
    await submitForm(formOf(mounted.container));
    await flushAsync();

    const container = mounted.container;
    await vi.waitFor(() => expect(container.textContent).toContain("El email ya pertenece a otro colaborador"));
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("pasa el resultado con invitación al padre para mostrar el enlace", async () => {
    const created = { id: "emp-new", inviteToken: "tok-1" };
    vi.mocked(createEmployeeAction).mockResolvedValue({ ok: true, value: created });
    const onCreatedWithInvite = vi.fn();
    mounted = renderForm({ onCreatedWithInvite });
    setFieldValue(fieldByName(mounted.container, "first_name"), "Marta");
    setFieldValue(fieldByName(mounted.container, "last_name"), "Lima");
    await submitForm(formOf(mounted.container));

    // El envío calcula la clave de idempotencia de forma asíncrona: se espera al
    // callback en lugar de suponer un número fijo de microtareas (lento en CI).
    await vi.waitFor(() => expect(onCreatedWithInvite).toHaveBeenCalledWith(created));
  });

  it("al salir del email busca un colaborador archivado y bloquea la creación", async () => {
    vi.mocked(findArchivedEmployeeByEmailAction).mockResolvedValue({
      id: "emp-old",
      name: "Luis Pérez",
      email: "luis@example.com",
    });
    mounted = renderForm();

    setFieldValue(fieldByLabel(mounted.container, "Email"), "luis@example.com");
    blur(fieldByLabel(mounted.container, "Email"));
    await flushAsync();

    expect(findArchivedEmployeeByEmailAction).toHaveBeenCalledWith("luis@example.com");
    expect(mounted.container.textContent).toContain("Ya existe un colaborador con ese email: Luis Pérez");
    expect(buttonWithText(mounted.container, "Crear colaborador").disabled).toBe(true);
  });

  it("restaura el colaborador archivado, cierra el formulario y refresca la vista", async () => {
    vi.mocked(findArchivedEmployeeByEmailAction).mockResolvedValue({
      id: "emp-old",
      name: "Luis Pérez",
      email: "luis@example.com",
    });
    vi.mocked(reactivateEmployeeAction).mockResolvedValue({ ok: true, value: undefined });
    const onCreated = vi.fn();
    mounted = renderForm({ onCreated });

    setFieldValue(fieldByLabel(mounted.container, "Email"), "luis@example.com");
    blur(fieldByLabel(mounted.container, "Email"));
    await flushAsync();
    click(buttonWithText(mounted.container, "Restaurar colaborador"));
    await flushAsync();

    expect(reactivateEmployeeAction).toHaveBeenCalledWith("emp-old");
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("limpia la coincidencia archivada al editar de nuevo el email", async () => {
    vi.mocked(findArchivedEmployeeByEmailAction).mockResolvedValue({
      id: "emp-old",
      name: "Luis Pérez",
      email: "luis@example.com",
    });
    mounted = renderForm();

    setFieldValue(fieldByLabel(mounted.container, "Email"), "luis@example.com");
    blur(fieldByLabel(mounted.container, "Email"));
    await flushAsync();
    setFieldValue(fieldByLabel(mounted.container, "Email"), "luis@example.co");

    expect(mounted.container.textContent).not.toContain("Ya existe un colaborador con ese email");
    expect(buttonWithText(mounted.container, "Crear colaborador").disabled).toBe(false);
  });

  it("cancelar notifica al padre sin enviar nada", () => {
    const onCreated = vi.fn();
    mounted = renderForm({ onCreated });

    click(buttonWithText(mounted.container, "Cancelar"));

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(createEmployeeAction).not.toHaveBeenCalled();
  });
});
