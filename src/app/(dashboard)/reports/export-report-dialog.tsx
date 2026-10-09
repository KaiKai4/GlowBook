"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, Download, History } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

// El usuario elige el alcance del archivo: el mes que ve, el año del acumulado
// o todo el historico del salon. Cada opcion descarga directo y cierra.
export function ExportReportDialog({
  monthKey,
  monthLabel,
  year,
}: {
  monthKey: string;
  monthLabel: string;
  year: number;
}) {
  const [open, setOpen] = useState(false);

  const options = [
    {
      href: `/api/reports/export?month=${monthKey}`,
      icon: CalendarRange,
      title: `Mes seleccionado (${monthLabel})`,
      description: "Resumen y detalle solo de ese mes.",
    },
    {
      href: `/api/reports/export?year=${year}`,
      icon: CalendarDays,
      title: `Año ${year}`,
      description: `Todos los meses de ${year}, con totales del año.`,
    },
    {
      href: "/api/reports/export",
      icon: History,
      title: "Histórico completo",
      description: "Todos los meses desde el primer movimiento, con totales.",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand-200 bg-surface px-4 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-50"
      >
        <Download className="h-4 w-4" />
        Exportar Excel
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Exportar a Excel"
        description="Elige qué datos quieres descargar."
        className="max-w-sm"
      >
        <div className="space-y-2.5">
          {options.map((option) => (
            <a
              key={option.href}
              href={option.href}
              download
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition-all hover:-translate-y-px hover:border-brand-300 hover:shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                <option.icon className="h-4 w-4 text-brand-600" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold capitalize text-fg-secondary">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs text-fg-subtle">{option.description}</span>
              </span>
            </a>
          ))}
        </div>
      </Dialog>
    </>
  );
}
