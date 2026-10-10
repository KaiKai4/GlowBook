"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, STOCK_STATUS_BADGES } from "@/components/ui/status-badge";
import {
  INVENTORY_LOCATION_LABELS,
  stockStatus,
} from "@/features/inventory/domain/stock";
import type { InventoryProductView } from "@/features/inventory";
import { formatCurrency } from "@/infra/format/money";
import { InventoryProductEditor } from "./inventory-product-editor";

type ProductFormKind = `edit:${string}` | `delete:${string}`;

type InventoryProductListProps = {
  products: InventoryProductView[];
  pendingForm: ProductFormKind | string | null;
  onSave: (productId: string, formData: FormData) => void;
  onDelete: (productId: string) => void;
};

export function InventoryProductList({ products, pendingForm, onSave, onDelete }: InventoryProductListProps) {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;

  const columns: DataTableColumn<InventoryProductView>[] = [
    {
      id: "product",
      header: "Producto",
      cell: (product) => <span className="font-semibold text-fg">{product.name}</span>,
    },
    {
      id: "category",
      header: "Categoría",
      secondary: true,
      cell: (product) => product.category || "Sin categoría",
    },
    {
      id: "status",
      header: "Estado",
      cell: (product) => (
        <StatusBadge
          variant={product.isActive ? "success" : "neutral"}
          label={product.isActive ? "Activo" : "Inactivo"}
        />
      ),
    },
    {
      id: "channel",
      header: "Vitrina",
      secondary: true,
      cell: (product) => (product.isRetailEnabled ? "Se vende en vitrina" : "Solo inventario/trabajo"),
    },
    {
      id: "stock",
      header: "Stock",
      secondary: true,
      cell: (product) => <StockLines product={product} />,
    },
    {
      id: "prices",
      header: "Precios",
      secondary: true,
      cell: (product) =>
        `Costo ${formatCurrency(product.costPrice)}${product.isRetailEnabled ? ` - Venta ${formatCurrency(product.salePrice)}` : ""}`,
    },
    {
      id: "actions",
      header: "Acciones",
      align: "right",
      cell: (product) => (
        <Button type="button" variant="outline" onClick={() => setEditingProductId(product.id)}>
          Editar producto
        </Button>
      ),
    },
  ];

  return (
    <Panel title="Productos">
      <DataTable
        label="Productos de inventario"
        columns={columns}
        rows={products}
        getRowId={(product) => product.id}
        emptyMessage="Aún no hay productos registrados."
      />

      {editingProduct && (
        <InventoryProductEditor
          product={editingProduct}
          pending={pendingForm === `edit:${editingProduct.id}`}
          pendingDelete={pendingForm === `delete:${editingProduct.id}`}
          onSave={(formData) => onSave(editingProduct.id, formData)}
          onDelete={() => onDelete(editingProduct.id)}
          onClose={() => setEditingProductId(null)}
        />
      )}
    </Panel>
  );
}

function StockLines({ product }: { product: InventoryProductView }) {
  return (
    <ul className="space-y-1">
      {product.stock
        .filter((stock) => product.isRetailEnabled || stock.location !== "retail")
        .map((stock) => {
          const status = stockStatus(stock.quantity, stock.minimumQuantity);
          return (
            <li key={stock.location} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-fg-muted">{INVENTORY_LOCATION_LABELS[stock.location]}</span>
              <span className="font-semibold text-fg">{stock.quantity}</span>
              <span className="text-xs text-fg-subtle">Min. {stock.minimumQuantity}</span>
              {status !== "ok" && <StatusBadge {...STOCK_STATUS_BADGES[status]} />}
            </li>
          );
        })}
    </ul>
  );
}
