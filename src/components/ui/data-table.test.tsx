// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buttonWithAriaLabel, click } from "@/test/ui-people-dom";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row {
  id: string;
  name: string;
  phone: string | null;
}

const COLUMNS: DataTableColumn<Row>[] = [
  { id: "name", header: "Nombre", cell: (row) => row.name },
  { id: "phone", header: "Teléfono", cell: (row) => row.phone, secondary: true },
  { id: "actions", header: "Acciones", cell: (row) => <button type="button">Ver {row.name}</button>, align: "right" },
];

function buildRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
    name: `Cliente ${index + 1}`,
    phone: index === 0 ? null : `600${index}`,
  }));
}

/** Elemento de una lista; falla con mensaje claro si no existe. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Falta el elemento ${index}`);
  return item;
}

function bodyRows(container: HTMLElement): HTMLTableRowElement[] {
  return Array.from(container.querySelectorAll<HTMLTableRowElement>("tbody tr"));
}

function cellsOf(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));
}

describe("DataTable", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("expone la tabla con su nombre accesible y una cabecera por columna", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(2)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    const table = mounted.container.querySelector("table");
    expect(table?.getAttribute("aria-label")).toBe("Clientes");
    expect(Array.from(mounted.container.querySelectorAll("th")).map((th) => th.textContent)).toEqual([
      "Nombre",
      "Teléfono",
      "Acciones",
    ]);
  });

  it("marca las columnas secundarias como ocultas en móvil y las repite bajo la primera columna", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(2)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    const phoneHeader = at(Array.from(mounted.container.querySelectorAll("th")), 1);
    expect(phoneHeader.className).toContain("hidden");
    expect(phoneHeader.className).toContain("sm:table-cell");

    const firstRowCells = cellsOf(at(bodyRows(mounted.container), 1));
    expect(at(firstRowCells, 1).className).toContain("sm:table-cell");
    const mobileLine = at(firstRowCells, 0).querySelector(".sm\\:hidden");
    expect(mobileLine?.textContent).toBe("6001");
    expect(mobileLine?.className).toContain("text-sm");
    expect(mobileLine?.className).toContain("text-fg-muted");
  });

  it("no repite bajo la primera columna un dato secundario que está vacío", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(1)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    const firstCell = at(cellsOf(at(bodyRows(mounted.container), 0)), 0);
    expect(firstCell.querySelector(".sm\\:hidden")).toBeNull();
  });

  it("alinea a la derecha las columnas con align right y da 52px de altura a cada celda", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(1)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    const cells = cellsOf(at(bodyRows(mounted.container), 0));
    expect(at(cells, 2).className).toContain("text-right");
    expect(cells.every((cell) => cell.className.includes("h-13"))).toBe(true);
  });

  it("muestra el mensaje de vacío y ningún control de paginación sin filas", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={[]} getRowId={(row) => row.id} emptyMessage="No hay clientes." />);

    expect(mounted.container.textContent).toContain("No hay clientes.");
    expect(mounted.container.querySelector("nav")).toBeNull();
  });

  it("no muestra paginación con 10 filas o menos", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(10)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    expect(bodyRows(mounted.container)).toHaveLength(10);
    expect(mounted.container.querySelector("nav")).toBeNull();
  });

  it("muestra 10 filas por página con Página X de Y y navega con los botones", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(25)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    expect(mounted.container.textContent).toContain("Página 1 de 3");
    expect(bodyRows(mounted.container)).toHaveLength(10);
    expect(bodyRows(mounted.container)[0]?.textContent).toContain("Cliente 1");
    expect(buttonWithAriaLabel(mounted.container, "Página anterior").disabled).toBe(true);
    expect(buttonWithAriaLabel(mounted.container, "Página siguiente").disabled).toBe(false);

    click(buttonWithAriaLabel(mounted.container, "Página siguiente"));
    expect(mounted.container.textContent).toContain("Página 2 de 3");
    expect(bodyRows(mounted.container)[0]?.textContent).toContain("Cliente 11");

    click(buttonWithAriaLabel(mounted.container, "Página siguiente"));
    expect(mounted.container.textContent).toContain("Página 3 de 3");
    expect(bodyRows(mounted.container)).toHaveLength(5);
    expect(buttonWithAriaLabel(mounted.container, "Página siguiente").disabled).toBe(true);

    click(buttonWithAriaLabel(mounted.container, "Página anterior"));
    expect(mounted.container.textContent).toContain("Página 2 de 3");
  });

  it("usa getRowId para la clave y deja que cada celda muestre su contenido", () => {
    mounted = mountComponent(<DataTable label="Clientes" columns={COLUMNS} rows={buildRows(2)} getRowId={(row) => row.id} emptyMessage="Vacío" />);

    const rows = bodyRows(mounted.container);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Cliente 1");
    expect(rows[1]?.textContent).toContain("Cliente 2");
    expect(mounted.container.querySelector("button")?.textContent).toBe("Ver Cliente 1");
  });
});
