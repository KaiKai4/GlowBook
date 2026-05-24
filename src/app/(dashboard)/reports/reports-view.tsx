"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/dates";
import { BarChart3, DollarSign, CalendarCheck, Tag, UserMinus, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Preset = "hoy" | "semana" | "mes" | "mes_anterior" | "30dias" | "90dias" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "30dias", label: "Últimos 30 días" },
  { value: "90dias", label: "Últimos 90 días" },
];

const STATUS_LABEL: Record<string, string> = {
  completed: "Completadas",
  confirmed: "Confirmadas",
  scheduled: "Agendadas",
  cancelled: "Canceladas",
  no_show: "No asistieron",
};
const STATUS_BAR: Record<string, string> = {
  completed: "bg-emerald-500",
  confirmed: "bg-violet-500",
  scheduled: "bg-blue-400",
  cancelled: "bg-stone-300",
  no_show: "bg-amber-400",
};
const STATUS_TEXT: Record<string, string> = {
  completed: "text-emerald-700",
  confirmed: "text-violet-700",
  scheduled: "text-blue-700",
  cancelled: "text-stone-500",
  no_show: "text-amber-700",
};

interface Props {
  from: string;
  to: string;
  preset: string;
  revenue: number;
  completedCount: number;
  totalCount: number;
  avgTicket: number;
  noShowRate: number;
  statusBreakdown: Array<{ status: string; count: number; pct: number }>;
  byEmployee: Array<{ name: string; count: number; revenue: number; pct: number }>;
  byService: Array<{ name: string; count: number; revenue: number; pct: number }>;
  newCustomers: number;
}

function dateLabel(from: string, to: string): string {
  const fmt = (s: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("es-PA", opts);
  if (from === to) return fmt(from, { day: "numeric", month: "long", year: "numeric" });
  return `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        {icon}
        <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function ReportsView({
  from, to, preset,
  revenue, completedCount, totalCount, avgTicket, noShowRate,
  statusBreakdown, byEmployee, byService, newCustomers,
}: Props) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function goPreset(p: Preset) {
    router.push(`/reports?preset=${p}`);
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      router.push(`/reports?from=${customFrom}&to=${customTo}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-violet-500" />
          Reportes
        </h1>
        <p className="text-sm text-stone-400 mt-0.5">{dateLabel(from, to)}</p>
      </div>

      {/* Period picker */}
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => goPreset(p.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                preset === p.value
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
          <span className="text-xs text-stone-400 shrink-0">Rango personalizado</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 rounded-lg border border-stone-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <span className="text-stone-300">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 rounded-lg border border-stone-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            className="h-8 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Ingresos totales", value: formatCurrency(revenue),
            icon: <DollarSign className="h-5 w-5" />, color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Citas completadas", value: `${completedCount} de ${totalCount}`,
            icon: <CalendarCheck className="h-5 w-5" />, color: "text-violet-600 bg-violet-50",
          },
          {
            label: "Ticket promedio", value: formatCurrency(avgTicket),
            icon: <Tag className="h-5 w-5" />, color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Tasa de no-show", value: `${noShowRate.toFixed(1)}%`,
            icon: <UserMinus className="h-5 w-5" />, color: "text-amber-600 bg-amber-50",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{card.value}</p>
              </div>
              <div className={cn("rounded-xl p-2.5", card.color)}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Estado + Clientes nuevos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Estado de citas" icon={<CalendarCheck className="h-4 w-4 text-stone-400" />}>
            {statusBreakdown.length === 0 ? (
              <p className="px-5 py-8 text-sm text-stone-400 text-center">Sin citas en este período.</p>
            ) : (
              <div className="divide-y divide-stone-50">
                {statusBreakdown.map((s) => (
                  <div key={s.status} className="px-5 py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-semibold", STATUS_TEXT[s.status] ?? "text-stone-700")}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-stone-800">{s.count}</span>
                        <span className="text-xs text-stone-400 w-10 text-right">{s.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <Bar pct={s.pct} color={STATUS_BAR[s.status] ?? "bg-stone-300"} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section title="Clientes nuevos" icon={<Users className="h-4 w-4 text-stone-400" />}>
          <div className="flex flex-col items-center justify-center px-5 py-10 text-center h-full">
            <p className="text-5xl font-bold text-violet-600">{newCustomers}</p>
            <p className="text-sm text-stone-500 mt-2">clientes registrados en el período</p>
            <p className="text-xs text-stone-400 mt-3 max-w-[160px]">
              Incluye clientes captados al completar citas
            </p>
          </div>
        </Section>
      </div>

      {/* Por empleado + Por servicio */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Por profesional" icon={<Users className="h-4 w-4 text-stone-400" />}>
          {byEmployee.length === 0 ? (
            <p className="px-5 py-8 text-sm text-stone-400 text-center">Sin datos en este período.</p>
          ) : (
            <div className="divide-y divide-stone-50">
              {byEmployee.map((emp, i) => (
                <div key={emp.name} className="px-5 py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-stone-800 truncate">{emp.name}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-stone-400">{emp.count} cita{emp.count !== 1 ? "s" : ""}</span>
                      <span className="text-sm font-bold text-emerald-700">{formatCurrency(emp.revenue)}</span>
                    </div>
                  </div>
                  <Bar pct={emp.pct} color="bg-violet-400" />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Por servicio" icon={<BarChart3 className="h-4 w-4 text-stone-400" />}>
          {byService.length === 0 ? (
            <p className="px-5 py-8 text-sm text-stone-400 text-center">Sin datos en este período.</p>
          ) : (
            <div className="divide-y divide-stone-50">
              {byService.map((svc, i) => (
                <div key={svc.name} className="px-5 py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-choco-50 text-xs font-bold text-choco-600">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-stone-800 truncate">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-stone-400">{svc.count}×</span>
                      <span className="text-sm font-bold text-stone-700">{formatCurrency(svc.revenue)}</span>
                    </div>
                  </div>
                  <Bar pct={svc.pct} color="bg-choco-400" />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
