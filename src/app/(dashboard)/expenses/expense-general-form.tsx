"use client";

import { useMemo, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createExpenseAction } from "./actions";

const CONCEPT_SUGGESTIONS = [
  "Alquiler",
  "Luz",
  "Agua",
  "Internet",
  "Suministros",
  "Herramientas",
  "Equipo",
  "Marketing",
  "Impuestos",
  "Nomina/comisiones",
];

export function ExpenseGeneralForm({
  onResult,
}: {
  onResult: (result: { ok: boolean; message: string }) => void;
}) {
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [pending, startTransition] = useTransition();

  function handleCreateExpense(formData: FormData) {
    startTransition(async () => {
      const result = await createExpenseAction(null, formData);
      onResult({
        ok: result.ok,
        message: result.ok ? result.value : result.error,
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo gasto general</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleCreateExpense} className="grid gap-4 lg:grid-cols-2">
          <DatePicker name="expense_date" label="Fecha" defaultValue={today} required />
          <Input name="amount" type="number" step="0.01" min="0.01" label="Monto" required />
          <div>
            <Input
              name="concept"
              label="Concepto del gasto"
              placeholder="Luz, computadora, impuestos..."
              list="expense-concepts"
              required
            />
            <datalist id="expense-concepts">
              {CONCEPT_SUGGESTIONS.map((concept) => (
                <option key={concept} value={concept} />
              ))}
            </datalist>
          </div>
          <Input name="vendor_name" label="Comercio / empresa" placeholder="Naturgy, Panafoto, arrendador..." />
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
