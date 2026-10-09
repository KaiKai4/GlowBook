"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
} from "@/components/forms/use-submission-intent";
import { formDataEntries, withIdempotencyKey } from "@/components/forms/form-data-intent";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from "@/features/expenses/schemas";
import { createExpenseAction } from "./actions";

export function ExpenseGeneralForm({
  onResult,
}: {
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<string>("rent");
  const toast = useToast();
  const { submit } = useSubmissionIntent({
    procedure: "expenses.create",
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });

  const isOther = category === "other";

  function handleCreateExpense(formData: FormData) {
    startTransition(async () => {
      const result = await submit(formDataEntries(formData), (idempotencyKey) =>
        createExpenseAction(null, withIdempotencyKey(formData, idempotencyKey))
      );
      onResult({
        ok: result.ok,
        message: result.ok ? result.value : result.error,
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo gasto</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleCreateExpense} className="grid gap-4 lg:grid-cols-2">
          <DatePicker name="expense_date" label="Fecha" defaultValue={today} required />
          <Input name="amount" type="number" step="0.01" min="0.01" label="Monto" required />

          <Select
            name="category"
            label="Categoría"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {EXPENSE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {EXPENSE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>

          {/* El concepto libre solo aplica a "Otro"; en las demás categorías la
              etiqueta sale del catálogo. */}
          {isOther ? (
            <Input
              name="concept"
              label="Describe el gasto"
              placeholder="Donación, multa, imprevisto..."
              required
            />
          ) : (
            <Input
              name="concept"
              label="Detalle (opcional)"
              placeholder="Ej. recibo de luz de marzo"
            />
          )}

          <Input name="vendor_name" label="Comercio / proveedor" placeholder="Naturgy, Panafoto, arrendador..." />

          <Input
            name="receipt_url"
            type="url"
            label="Comprobante (enlace, opcional)"
            placeholder="https://..."
          />

          <div className="lg:col-span-2">
            <Textarea name="note" label="Nota" />
          </div>
          <div className="lg:col-span-2">
            <Button loading={pending} variant="primary" type="submit">
              Registrar gasto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
