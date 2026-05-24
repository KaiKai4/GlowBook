"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, addMinutes, formatTimeTz, getZonedTimeParts } from "@/lib/utils/dates";
import { evaluateTimeRange } from "@/features/appointments/domain/availability";
import type { BusinessHour, SalonConfig, WorkSchedule } from "@/features/appointments/domain/types";
import { Trash2, Plus, Check, GripVertical, UserPlus, Users, Scissors, User } from "lucide-react";
import { createAppointmentAction, getOccupiedSlotsForDate, type OccupiedByEmployee } from "../actions";
import { findOrCreateCustomerAction, checkCustomerPhoneAction } from "../../customers/actions";
import { cn } from "@/lib/utils/cn";

interface Customer { id: string; name: string }
interface Category { id: string; name: string }
interface Service { id: string; name: string; category_id: string; duration_minutes: number; price: number }
interface Employee {
  id: string; name: string; service_ids: string[]; category_ids: string[]; work_schedules: WorkSchedule[];
}
interface Row { key: string; categoryId: string; serviceId: string; employeeId: string }

let rowSeq = 0;
const newRow = (): Row => ({ key: `r${rowSeq++}`, categoryId: "", serviceId: "", employeeId: "" });

// Time options 6:00 AM → 9:30 PM in 15-min increments with 12h display.
// Hours 1–7 are always PM so staff never accidentally books at 3 AM.
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 30) break;
      const h24 = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "p.m." : "a.m.";
      opts.push({ value: h24, label: `${h12}:${String(m).padStart(2, "0")} ${ampm}` });
    }
  }
  return opts;
})();

// Salon open window ("HH:MM") for a given YYYY-MM-DD, or null if closed that day.
// day_of_week is 0 = Monday … 6 = Sunday, matching the salon_business_hours table.
function salonWindowFor(
  dateStr: string,
  timezone: string,
  businessHours: BusinessHour[]
): { open: string; close: string } | null {
  if (!dateStr) return null;
  const dow = getZonedTimeParts(new Date(`${dateStr}T12:00:00Z`), timezone).dayOfWeek;
  const cfg = businessHours.find((h) => h.day_of_week === dow);
  if (!cfg || !cfg.is_open || !cfg.open_time || !cfg.close_time) return null;
  return { open: cfg.open_time.slice(0, 5), close: cfg.close_time.slice(0, 5) };
}

function TimePicker({
  label, value, onChange, minTime, maxTime,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minTime?: string;
  maxTime?: string;
}) {
  // Restrict the selectable times to the salon's open window for the chosen day.
  const options = useMemo(() => {
    const filtered = TIME_OPTIONS.filter(
      (o) => (!minTime || o.value >= minTime) && (!maxTime || o.value < maxTime)
    );
    return filtered.length > 0 ? filtered : TIME_OPTIONS;
  }, [minTime, maxTime]);

  // Snap to nearest available option if value isn't in the list
  const snapped = useMemo(() => {
    if (options.some((o) => o.value === value)) return value;
    const [h, m] = value.split(":").map(Number);
    const mins = h * 60 + m;
    let nearest = options[0].value;
    let minDiff = Infinity;
    for (const o of options) {
      const [oh, om] = o.value.split(":").map(Number);
      const diff = Math.abs(oh * 60 + om - mins);
      if (diff < minDiff) { minDiff = diff; nearest = o.value; }
    }
    return nearest;
  }, [value, options]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-stone-700">{label}</label>
      <div className="relative">
        <select
          value={snapped}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Clock className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
      </div>
    </div>
  );
}

const STEPS = ["Cliente", "Servicios", "Resumen"] as const;

export function AppointmentWizard({
  customers, categories, services, employees, salonConfig, businessHours,
}: {
  customers: Customer[];
  categories: Category[];
  services: Service[];
  employees: Employee[];
  salonConfig: SalonConfig;
  businessHours: BusinessHour[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — customer
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [checkingPhone, startCheckPhone] = useTransition();
  const [custError, setCustError] = useState<string | null>(null);

  // Step 2 — date/time/services
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [occupied, setOccupied] = useState<OccupiedByEmployee>({});
  const [loadingAvail, startAvail] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Step 3 — submit
  const [notes, setNotes] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  // ── Customer step ──────────────────────────────────────────────
  function continueFromCustomer() {
    setCustError(null);
    if (mode === "existing") {
      if (!customerId) return;
      setCustomerName(customers.find((c) => c.id === customerId)?.name ?? "");
      setStep(2);
      return;
    }
    if (!newFirst || !newLast) {
      setCustError("Nombre y apellido son obligatorios.");
      return;
    }
    if (newPhone) {
      startCheckPhone(async () => {
        const { exists } = await checkCustomerPhoneAction(newPhone);
        if (exists) {
          setCustError("Este número ya está registrado. Búscalo en \"Cliente existente\".");
          return;
        }
        setCustomerName(`${newFirst} ${newLast}`);
        setStep(2);
      });
    } else {
      setCustomerName(`${newFirst} ${newLast}`);
      setStep(2);
    }
  }

  // ── Availability ───────────────────────────────────────────────
  function loadAvailability(d: string) {
    if (!d) return;
    startAvail(async () => {
      const slots = await getOccupiedSlotsForDate(d);
      setOccupied(slots);
    });
  }

  // Salon open window for the selected day — drives the time picker + closed-day notice.
  const selectedWindow = useMemo(
    () => salonWindowFor(date, salonConfig.timezone, businessHours),
    [date, salonConfig.timezone, businessHours]
  );
  const isClosedDay = !!date && selectedWindow === null;

  // Sequential schedule
  const schedule = useMemo(() => {
    if (!date) return [] as Array<{ row: Row; svc: Service | undefined; start: Date | null; end: Date | null }>;
    const base = new Date(`${date}T${time}:00`);
    return rows.reduce<Array<{ row: Row; svc: Service | undefined; start: Date | null; end: Date | null }>>(
      (acc, r) => {
        const svc = serviceMap.get(r.serviceId);
        const start = acc.length ? acc[acc.length - 1].end : base;
        const end = svc && start ? addMinutes(start, svc.duration_minutes) : start;
        return [...acc, { row: r, svc, start, end }];
      },
      []
    );
  }, [rows, date, time, serviceMap]);

  function eligibleEmployees(serviceId: string, start: Date | null, end: Date | null): Employee[] {
    const svc = serviceMap.get(serviceId);
    if (!svc) return [];
    const candidates = employees.filter(
      (e) => e.service_ids.includes(serviceId) && e.category_ids.includes(svc.category_id)
    );
    if (!start || !end) return candidates;
    return candidates.filter((e) => {
      const violations = evaluateTimeRange({
        start, end, salonConfig, businessHours,
        workSchedules: e.work_schedules,
        occupiedSlots: occupied[e.id] ?? [],
        enforceSalonSchedule: false,
        enforceNotice: false,
        enforceMinDuration: false,
      });
      return violations.length === 0;
    });
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRowFn() { setRows((prev) => [...prev, newRow()]); }
  function removeRow(key: string) { setRows((prev) => prev.filter((r) => r.key !== key)); }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setRows((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  const validRows = rows.filter((r) => r.serviceId && r.employeeId);
  const total = validRows.reduce((s, r) => s + (serviceMap.get(r.serviceId)?.price ?? 0), 0);
  const step2Valid = rows.length > 0 && rows.every((r) => r.serviceId && r.employeeId) && !!date && !!time && !isClosedDay;

  function handleConfirm() {
    setSubmitError(null);
    startSubmit(async () => {
      let finalCustomerId = customerId;

      if (mode === "new") {
        const custRes = await findOrCreateCustomerAction(
          newFirst, newLast, newPhone || undefined
        );
        if (!custRes.ok) { setSubmitError(custRes.error); return; }
        finalCustomerId = custRes.value;
      }

      const base = new Date(`${date}T${time}:00`);
      const fd = new FormData();
      fd.set("customer_id", finalCustomerId);
      fd.set("start_time", base.toISOString());
      fd.set("notes", notes);
      fd.set("assignments", JSON.stringify(rows.map((r) => ({ service_id: r.serviceId, employee_id: r.employeeId }))));

      const res = await createAppointmentAction(null, fd);
      if (res.ok) {
        router.push(`/appointments?date=${date}`);
        router.refresh();
      } else {
        setSubmitError(res.error);
      }
    });
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const idx = i + 1;
          const done = step > idx;
          const active = step === idx;
          return (
            <div key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all",
                  done
                    ? "bg-emerald-500 text-white shadow-sm"
                    : active
                      ? "bg-violet-600 text-white shadow-[0_0_0_4px_rgba(124,58,237,0.15)]"
                      : "bg-stone-100 text-stone-400"
                )}>
                  {done ? <Check className="h-4 w-4" /> : idx}
                </div>
                <div>
                  <p className={cn(
                    "text-xs font-medium leading-none",
                    active ? "text-violet-600" : done ? "text-emerald-600" : "text-stone-400"
                  )}>
                    Paso {idx}
                  </p>
                  <p className={cn(
                    "text-sm font-semibold",
                    active ? "text-stone-900" : done ? "text-stone-500" : "text-stone-300"
                  )}>
                    {label}
                  </p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 mx-4 h-0.5 rounded-full",
                  done ? "bg-emerald-400" : "bg-stone-200"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1 — Cliente ────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-violet-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-800">Seleccionar cliente</h2>
              <p className="text-xs text-stone-400">Cliente existente o registrar uno nuevo</p>
            </div>
          </div>
          <CardContent className="space-y-5 pt-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setCustError(null); setMode("existing"); }}
                disabled={customers.length === 0}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border-2 p-4 text-sm font-medium transition-all disabled:opacity-40",
                  mode === "existing"
                    ? "border-violet-400 bg-violet-50 text-violet-700"
                    : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                )}
              >
                <Users className="h-4 w-4" /> Cliente existente
              </button>
              <button
                type="button"
                onClick={() => { setCustError(null); setMode("new"); }}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border-2 p-4 text-sm font-medium transition-all",
                  mode === "new"
                    ? "border-violet-400 bg-violet-50 text-violet-700"
                    : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                )}
              >
                <UserPlus className="h-4 w-4" /> Cliente nuevo
              </button>
            </div>

            {mode === "existing" ? (
              <Select label="Cliente" value={customerId} onChange={(e) => { setCustError(null); setCustomerId(e.target.value); }}>
                <option value="">Selecciona un cliente...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Nombre" value={newFirst} onChange={(e) => { setCustError(null); setNewFirst(e.target.value); }} />
                  <Input label="Apellido" value={newLast} onChange={(e) => { setCustError(null); setNewLast(e.target.value); }} />
                </div>
                <Input label="Teléfono (opcional)" type="tel" value={newPhone} onChange={(e) => { setCustError(null); setNewPhone(e.target.value); }} />
              </div>
            )}

            {custError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {custError}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                size="lg"
                onClick={continueFromCustomer}
                loading={checkingPhone}
                disabled={mode === "existing" ? !customerId : false}
              >
                Continuar →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2 — Servicios y horario ────────────────────────── */}
      {step === 2 && (
        <Card>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-violet-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-choco-50">
              <Scissors className="h-4 w-4 text-choco-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-800">Servicios y horario</h2>
              <p className="text-xs text-stone-400">Define fecha, hora y los servicios a realizar</p>
            </div>
          </div>
          <CardContent className="space-y-6 pt-5">
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100">
              <Input
                label="Fecha"
                type="date"
                value={date}
                onChange={(e) => {
                  const d = e.target.value;
                  setDate(d);
                  loadAvailability(d);
                  const w = salonWindowFor(d, salonConfig.timezone, businessHours);
                  if (w && (time < w.open || time >= w.close)) setTime(w.open);
                }}
                required
              />
              <TimePicker
                label="Hora de inicio"
                value={time}
                onChange={setTime}
                minTime={selectedWindow?.open}
                maxTime={selectedWindow?.close}
              />
            </div>

            {!date ? (
              <div className="rounded-xl border border-dashed border-stone-200 py-8 text-center">
                <p className="text-sm text-stone-400">Elige una fecha para ver la disponibilidad.</p>
              </div>
            ) : isClosedDay ? (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 py-8 text-center">
                <p className="text-sm font-medium text-amber-700">El salón está cerrado ese día.</p>
                <p className="text-xs text-amber-600 mt-0.5">Elige otra fecha o ajusta los horarios en Configuración del salón.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Servicios</p>
                  {loadingAvail && (
                    <span className="text-xs text-violet-500 animate-pulse">Cargando disponibilidad...</span>
                  )}
                </div>

                <p className="text-xs text-stone-400 flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  Arrastra para cambiar el orden de los servicios
                </p>

                {schedule.map((item, i) => {
                  const filteredServices = item.row.categoryId
                    ? services.filter((s) => s.category_id === item.row.categoryId)
                    : [];
                  const eligibles = item.row.serviceId
                    ? eligibleEmployees(item.row.serviceId, item.start, item.end)
                    : [];
                  const selectedStillEligible =
                    !item.row.employeeId || eligibles.some((e) => e.id === item.row.employeeId);

                  return (
                    <div
                      key={item.row.key}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragIndex !== null) reorder(dragIndex, i); setDragIndex(null); }}
                      className={cn(
                        "rounded-xl border bg-white p-4 transition-all",
                        dragIndex === i
                          ? "border-violet-400 shadow-[0_0_0_2px_rgba(124,58,237,0.15)]"
                          : "border-violet-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
                      )}
                    >
                      {/* Row header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="cursor-grab text-stone-300 hover:text-stone-400 transition-colors">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-semibold text-stone-700">
                            Servicio {i + 1}
                          </span>
                          {item.start && (
                            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                              {formatTimeTz(item.start, salonConfig.timezone)}
                              {item.end && ` – ${formatTimeTz(item.end, salonConfig.timezone)}`}
                            </span>
                          )}
                        </div>
                        {rows.length > 1 && (
                          <button
                            onClick={() => removeRow(item.row.key)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            aria-label="Quitar servicio"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Row selects */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Select
                          label="Categoría"
                          value={item.row.categoryId}
                          onChange={(e) =>
                            updateRow(item.row.key, { categoryId: e.target.value, serviceId: "", employeeId: "" })
                          }
                        >
                          <option value="">Selecciona categoría...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </Select>

                        <Select
                          label="Servicio"
                          value={item.row.serviceId}
                          onChange={(e) => updateRow(item.row.key, { serviceId: e.target.value, employeeId: "" })}
                          disabled={!item.row.categoryId}
                        >
                          <option value="">
                            {!item.row.categoryId ? "Elige categoría primero" : filteredServices.length ? "Selecciona servicio..." : "Sin servicios"}
                          </option>
                          {filteredServices.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.duration_minutes}min)
                            </option>
                          ))}
                        </Select>

                        <Select
                          label="Profesional"
                          value={item.row.employeeId}
                          onChange={(e) => updateRow(item.row.key, { employeeId: e.target.value })}
                          disabled={!item.row.serviceId}
                          error={!selectedStillEligible ? "Ya no disponible" : undefined}
                        >
                          <option value="">
                            {!item.row.serviceId
                              ? "Elige servicio primero"
                              : eligibles.length
                                ? "Selecciona profesional..."
                                : "Nadie disponible"}
                          </option>
                          {eligibles.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  );
                })}

                <Button variant="outline" size="sm" onClick={addRowFn} className="w-full border-dashed">
                  <Plus className="h-4 w-4" /> Agregar otro servicio
                </Button>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-stone-100">
              <Button variant="ghost" onClick={() => setStep(1)}>← Atrás</Button>
              <Button variant="primary" size="lg" onClick={() => setStep(3)} disabled={!step2Valid}>
                Continuar →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3 — Resumen ────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-violet-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-800">Confirmar cita</h2>
              <p className="text-xs text-stone-400">Revisa los detalles antes de confirmar</p>
            </div>
          </div>
          <CardContent className="space-y-5 pt-5">
            {/* Cliente */}
            <div className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
                <User className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-violet-500 font-medium">Cliente</p>
                <p className="text-sm font-semibold text-stone-800">{customerName}</p>
              </div>
            </div>

            {/* Servicios */}
            <div className="rounded-xl border border-stone-100 overflow-hidden">
              {schedule.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 gap-3",
                    i < schedule.length - 1 && "border-b border-stone-100"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-800">{item.svc?.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      <span className="text-violet-600 font-medium">
                        {item.start && formatTimeTz(item.start, salonConfig.timezone)}
                        {item.end && ` – ${formatTimeTz(item.end, salonConfig.timezone)}`}
                      </span>
                      {" · "}
                      {employees.find((e) => e.id === item.row.employeeId)?.name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-stone-700 shrink-0">
                    {formatCurrency(item.svc?.price ?? 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-xl bg-choco-50 border border-choco-100 px-4 py-3">
              <span className="text-sm font-semibold text-choco-700">Total</span>
              <span className="text-lg font-bold text-choco-700">{formatCurrency(total)}</span>
            </div>

            <Textarea
              label="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, alergias, preferencias..."
            />

            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {submitError}
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-stone-100">
              <Button variant="ghost" onClick={() => setStep(2)}>← Atrás</Button>
              <Button variant="primary" size="lg" onClick={handleConfirm} loading={submitting}>
                <Check className="h-4 w-4" />
                Confirmar cita
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
