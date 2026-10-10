"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { Trash2, Plus } from "lucide-react";
import { addWorkScheduleAction, deleteWorkScheduleAction } from "../actions-schedule";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export function WorkScheduleEditor({
  employeeId,
  schedules,
}: {
  employeeId: string;
  schedules: Schedule[];
}) {
  const [pending, startAdd] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const formRef = useRef<HTMLFormElement>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startAdd(async () => {
      const result = await addWorkScheduleAction(null, formData);
      if (result.ok) {
        formRef.current?.reset();
        setStartTime("09:00");
        setEndTime("17:00");
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(scheduleId: string) {
    setError(null);
    startDelete(async () => {
      const result = await deleteWorkScheduleAction(scheduleId, employeeId);
      if (!result.ok) setError(result.error);
    });
  }

  const sorted = [...schedules].sort((a, b) =>
    a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg-secondary">Horario laboral</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" />
          Agregar bloque
        </Button>
      </div>

      {open && (
        <form ref={formRef} action={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-border-subtle p-3">
          <input type="hidden" name="employee_id" value={employeeId} />
          <div className="w-36">
            <Select name="day_of_week" label="Día" defaultValue="0">
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <TimePicker
              name="start_time"
              label="Inicio"
              value={startTime}
              onChange={setStartTime}
              compact
              required
            />
          </div>
          <div className="w-28">
            <TimePicker
              name="end_time"
              label="Fin"
              value={endTime}
              onChange={setEndTime}
              compact
              required
            />
          </div>
          <Button type="submit" variant="primary" size="sm" loading={pending}>
            Guardar
          </Button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger-strong">{error}</p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          Sin horario configurado. (Si no hay horario, se usa el del salón.)
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {sorted.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-fg-secondary">
                <span className="font-medium">{DAYS[s.day_of_week]}</span>{" "}
                {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
              </span>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={isDeleting}
                className="text-fg-subtle hover:text-danger disabled:opacity-50"
                aria-label="Eliminar"
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
