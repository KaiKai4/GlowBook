"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addScheduleExceptionAction, removeScheduleExceptionAction } from "../actions-schedule";

interface ScheduleException {
  id: string;
  date: string;
  reason: string;
}

function exceptionDateLabel(date: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function localToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Días libres puntuales (vacaciones, permisos): bloquean la agenda de ese
// colaborador en esa fecha aunque su horario semanal diga que trabaja.
export function ScheduleExceptionsPanel({
  employeeId,
  exceptions,
}: {
  employeeId: string;
  exceptions: ScheduleException[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const today = localToday();

  function handleAdd() {
    if (!date) {
      setError("Selecciona la fecha del día libre.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addScheduleExceptionAction(employeeId, date, reason);
      if (result.ok) {
        toast.success("Día libre registrado.");
        setDate("");
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove(exceptionId: string) {
    setRemovingId(exceptionId);
    startTransition(async () => {
      const result = await removeScheduleExceptionAction(employeeId, exceptionId);
      setRemovingId(null);
      if (result.ok) {
        toast.success("Día libre eliminado.");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo eliminar el día libre.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarOff className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-fg-secondary">Días libres y excepciones</h3>
      </div>
      <p className="text-xs text-fg-subtle">
        En estas fechas no se podrán agendar citas con este colaborador, aunque su horario
        semanal indique que trabaja.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Input
            type="date"
            label="Fecha"
            min={today}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <Input
            label="Motivo (opcional)"
            placeholder="Vacaciones, permiso..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
          />
        </div>
        <Button variant="primary" size="sm" className="h-10" loading={pending && !removingId} onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-danger-border-subtle bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{error}</p>
      )}

      {exceptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted px-3 py-4 text-center text-xs text-fg-subtle">
          Sin días libres próximos.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-lg border border-border">
          {exceptions.map((exception) => (
            <li key={exception.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold capitalize text-fg-secondary">
                  {exceptionDateLabel(exception.date)}
                </p>
                {exception.reason && <p className="text-xs text-fg-subtle">{exception.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(exception.id)}
                disabled={removingId === exception.id}
                aria-label="Eliminar día libre"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-danger-subtle hover:text-danger-strong disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
