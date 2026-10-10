"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type NewProductFormProps = {
  pending: boolean;
  onCreate: (formData: FormData) => void;
};

export function NewProductForm({ pending, onCreate }: NewProductFormProps) {
  const [retailEnabled, setRetailEnabled] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo producto</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onCreate} className="grid gap-4 md:grid-cols-2">
          <Input name="name" label="Producto" placeholder="Shampoo hidratante" required />
          <Input name="category" label="Categoría" placeholder="Cabello" />
          <Input name="cost_price" type="number" step="0.01" min="0" label="Costo" defaultValue="0" />
          <Select
            id="se-vende-en-vitrina"
            name="is_retail_enabled"
            label="Se vende en vitrina"
            value={String(retailEnabled)}
            onChange={(event) => setRetailEnabled(event.target.value === "true")}
          >
            <option value="true">Si, aparece en Vitrina</option>
            <option value="false">No, solo inventario/trabajo</option>
          </Select>
          <Input
            name="sale_price"
            type="number"
            step="0.01"
            min="0"
            label="Precio venta"
            defaultValue="0"
            disabled={!retailEnabled}
            hint={!retailEnabled ? "No aplica para productos que no se venden en vitrina." : undefined}
          />
          <StockInputs prefix="retail" label="Vitrina" disabled={!retailEnabled} />
          <StockInputs prefix="internal" label="Uso interno" />
          <StockInputs prefix="storage" label="Bodega" />
          <div className="md:col-span-2">
            <Button loading={pending} variant="primary" type="submit">
              Crear producto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StockInputs({
  prefix,
  label,
  disabled = false,
}: {
  prefix: "retail" | "internal" | "storage";
  label: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="rounded-xl border border-border-subtle p-3">
      <legend className="px-1 text-xs font-semibold uppercase text-fg-subtle">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name={`${prefix}_quantity`}
          type="number"
          step="0.01"
          min="0"
          label="Cantidad"
          placeholder="0"
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Input
          name={`${prefix}_minimum`}
          type="number"
          step="0.01"
          min="0"
          label="Mínimo"
          placeholder="0"
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
    </fieldset>
  );
}
