// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithText, click } from "@/test/ui-people-dom";
import { buildCategory, buildService } from "@/test/ui-people-fixtures";
import { ArchiveCategoryDialog } from "./archive-category-dialog";

describe("ArchiveCategoryDialog", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("no se muestra mientras no hay categoría seleccionada para archivar", () => {
    mounted = mountComponent(
      <ArchiveCategoryDialog category={null} pending={false} error={null} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(mounted.container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("nombra la categoría y advierte cuántos servicios dejarán de aparecer", () => {
    const category = buildCategory({
      name: "Uñas",
      services: [buildService({ id: "s1" }), buildService({ id: "s2" })],
    });
    mounted = mountComponent(
      <ArchiveCategoryDialog category={category} pending={false} error={null} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(mounted.container.textContent).toContain('Vas a archivar "Uñas".');
    expect(mounted.container.textContent).toContain("Sus 2 servicios no apareceran al crear nuevas citas.");
    expect(mounted.container.textContent).toContain("Las citas, cobros y reportes historicos se conservaran.");
  });

  it("indica que no hay servicios asociados cuando la categoría está vacía", () => {
    mounted = mountComponent(
      <ArchiveCategoryDialog
        category={buildCategory({ services: [] })}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(mounted.container.textContent).toContain("No tiene servicios asociados.");
  });

  it("confirma el archivado con el botón destructivo", () => {
    const onConfirm = vi.fn();
    mounted = mountComponent(
      <ArchiveCategoryDialog category={buildCategory()} pending={false} error={null} onClose={vi.fn()} onConfirm={onConfirm} />
    );

    click(buttonWithText(mounted.container, "Archivar categoria"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancela sin confirmar cuando no hay operación en curso", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    mounted = mountComponent(
      <ArchiveCategoryDialog category={buildCategory()} pending={false} error={null} onClose={onClose} onConfirm={onConfirm} />
    );

    click(buttonWithText(mounted.container, "Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("impide cerrar el diálogo desde la X mientras el archivado está pendiente", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <ArchiveCategoryDialog category={buildCategory()} pending error={null} onClose={onClose} onConfirm={vi.fn()} />
    );

    const closeButton = mounted.container.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]');
    if (!closeButton) throw new Error("falta el botón de cerrar");
    click(closeButton);

    expect(onClose).not.toHaveBeenCalled();
    expect(buttonWithText(mounted.container, "Cancelar").disabled).toBe(true);
    expect(buttonWithText(mounted.container, "Archivar categoria").disabled).toBe(true);
  });

  it("muestra el error devuelto por la acción de archivado", () => {
    mounted = mountComponent(
      <ArchiveCategoryDialog category={buildCategory()} pending={false} error="No se pudo archivar la categoría" onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(mounted.container.textContent).toContain("No se pudo archivar la categoría");
  });
});
