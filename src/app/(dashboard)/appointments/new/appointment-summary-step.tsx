"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Check, User } from "lucide-react";
import type {
  AppointmentScheduleItem,
  EmployeeOption,
} from "./appointment-wizard-types";

export function AppointmentSummaryStep({
  customerName,
  schedule,
  employees,
  timezone,
  total,
  notes,
  setNotes,
  submitError,
  submitting,
  onBack,
  onConfirm,
}: {
  customerName: string;
  schedule: AppointmentScheduleItem[];
  employees: EmployeeOption[];
  timezone: string;
  total: number;
  notes: string;
  setNotes: (notes: string) => void;
  submitError: string | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-subtle">
          <Check className="h-4 w-4 text-success" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg-secondary">Confirmar cita</h2>
          <p className="text-xs text-fg-subtle">Revisa los detalles antes de confirmar</p>
        </div>
      </div>

      <CardContent className="space-y-5 pt-5">
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-brand-600 font-medium">Cliente</p>
            <p className="text-sm font-semibold text-fg-secondary">{customerName}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle overflow-hidden">
          {schedule.map((item, index) => (
            <div
              key={item.row.key}
              className={cn(
                "flex items-center justify-between px-4 py-3.5 gap-3",
                index < schedule.length - 1 && "border-b border-border-subtle"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg-secondary">{item.service?.name}</p>
                <p className="text-xs text-fg-subtle mt-0.5">
                  <span className="text-brand-600 font-medium">
                    {item.start && formatTimeTz(item.start, timezone)}
                    {item.end && ` - ${formatTimeTz(item.end, timezone)}`}
                  </span>
                  {" · "}
                  {employees.find((employee) => employee.id === item.row.employeeId)?.name}
                </p>
              </div>
              <span className="text-sm font-semibold text-fg-secondary shrink-0">
                {formatCurrency(item.service?.price ?? 0)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-choco-50 border border-choco-100 px-4 py-3">
          <span className="text-sm font-semibold text-choco-700">Total</span>
          <span className="text-lg font-semibold text-choco-700">{formatCurrency(total)}</span>
        </div>

        <Textarea
          label="Notas (opcional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Instrucciones especiales, alergias, preferencias..."
        />

        {submitError && (
          <div className="rounded-lg bg-danger-subtle border border-danger-border px-4 py-3 text-sm text-danger-strong">
            {submitError}
          </div>
        )}

        <div className="flex justify-between pt-2 border-t border-border-subtle">
          <Button variant="ghost" onClick={onBack}>
            Atras
          </Button>
          <Button variant="primary" size="lg" onClick={onConfirm} loading={submitting}>
            <Check className="h-4 w-4" />
            Confirmar cita
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
