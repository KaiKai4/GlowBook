"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { Settings, Clock, Check, Store, Palette, CreditCard, Plus, X } from "lucide-react";
import {
  updateSalonInfoAction,
  updateBusinessHoursAction,
  updateSalonThemeAction,
  updateSalonBgAction,
  updateSalonPaymentMethodsAction,
} from "./actions";
import { useUnsavedChanges } from "@/components/layout/unsaved-changes";
import {
  DEFAULT_PAYMENT_METHOD_OPTIONS,
  normalizePaymentMethod,
  normalizePaymentMethods,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/features/payments/domain/payment-methods";
import type { BusinessDay } from "./page";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Representative swatches per palette (must match the scales in globals.css).
const THEMES: { key: string; label: string; swatches: string[] }[] = [
  { key: "violet", label: "Violeta", swatches: ["#ede9fe", "#a78bfa", "#7c3aed", "#4c1d95"] },
  { key: "mocco", label: "Mocco", swatches: ["#f1e7df", "#b58a6b", "#835741", "#3e2522"] },
  { key: "tiffany", label: "Tiffany Blue", swatches: ["#cdf3f0", "#34bdb8", "#0d8884", "#134645"] },
  { key: "viridian", label: "Viridian", swatches: ["#d6ebdd", "#5b9077", "#2f6750", "#0b2b26"] },
  { key: "yellow", label: "Yellow", swatches: ["#fdeecb", "#f5a623", "#bd6e08", "#4d2c0c"] },
  { key: "rosewater", label: "Rosewater", swatches: ["#fbe1e8", "#e06e95", "#a83a64", "#2b124c"] },
];

export function SalonSettings({
  salonName,
  timezone,
  theme,
  bgStyle,
  paymentMethods,
  businessHours,
}: {
  salonName: string;
  timezone: string;
  theme: string;
  bgStyle: string;
  paymentMethods: PaymentMethod[];
  businessHours: BusinessDay[];
}) {
  // ── Salon name ──────────────────────────────────────────────────
  const [savingName, startName] = useTransition();
  const [nameValue, setNameValue] = useState(salonName);
  const [savedName, setSavedName] = useState(salonName);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function saveName(formData: FormData) {
    setNameError(null);
    setNameSaved(false);
    startName(async () => {
      const res = await updateSalonInfoAction(null, formData);
      if (res.ok) {
        setNameSaved(true);
        setSavedName(nameValue);
      } else setNameError(res.error);
    });
  }

  // ── Business hours ──────────────────────────────────────────────
  const [hours, setHours] = useState<BusinessDay[]>(businessHours);
  const [savedHours, setSavedHours] = useState<BusinessDay[]>(businessHours);
  const [savingHours, startHours] = useTransition();
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  function updateDay(day: number, patch: Partial<BusinessDay>) {
    setHours((prev) => prev.map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)));
    setHoursSaved(false);
    setHoursError(null);
  }

  function saveHours() {
    setHoursError(null);
    setHoursSaved(false);
    for (const d of hours) {
      if (d.is_open && !(d.open_time < d.close_time)) {
        setHoursError(`${DAY_LABELS[d.day_of_week]}: la hora de cierre debe ser mayor que la de apertura.`);
        return;
      }
    }
    startHours(async () => {
      const res = await updateBusinessHoursAction(JSON.stringify(hours));
      if (res.ok) {
        setHoursSaved(true);
        setSavedHours(hours);
      } else setHoursError(res.error);
    });
  }

  // Payment methods
  const [enabledPayments, setEnabledPayments] = useState<PaymentMethod[]>(paymentMethods);
  const [savedPayments, setSavedPayments] = useState<PaymentMethod[]>(paymentMethods);
  const [savingPayments, startPayments] = useTransition();
  const [paymentsSaved, setPaymentsSaved] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");

  function addPaymentMethod(value: string) {
    const method = normalizePaymentMethod(value);
    setPaymentsSaved(false);
    setPaymentsError(null);

    if (!method) {
      setPaymentsError("Escribe un metodo de pago.");
      return;
    }

    if (method.length > 64) {
      setPaymentsError("El metodo de pago no puede superar 64 caracteres.");
      return;
    }

    if (enabledPayments.some((item) => item.toLocaleLowerCase() === method.toLocaleLowerCase())) {
      setPaymentsError("Ese metodo de pago ya esta en la lista.");
      return;
    }

    setEnabledPayments((current) => [...current, method]);
    setNewPaymentMethod("");
  }

  function removePaymentMethod(method: PaymentMethod) {
    setPaymentsSaved(false);
    setPaymentsError(null);
    setEnabledPayments((current) => current.filter((item) => item !== method));
  }

  function savePaymentMethods() {
    setPaymentsError(null);
    setPaymentsSaved(false);
    const methodsToSave = normalizePaymentMethods(enabledPayments);

    if (methodsToSave.length === 0) {
      setPaymentsError("Agrega al menos un metodo de pago.");
      return;
    }

    startPayments(async () => {
      const res = await updateSalonPaymentMethodsAction(methodsToSave);
      if (res.ok) {
        setPaymentsSaved(true);
        setEnabledPayments(methodsToSave);
        setSavedPayments(methodsToSave);
      } else setPaymentsError(res.error);
    });
  }

  // ── Color theme ─────────────────────────────────────────────────
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [, startTheme] = useTransition();
  const [themeError, setThemeError] = useState<string | null>(null);

  function applyTheme(key: string) {
    if (typeof document !== "undefined") {
      document.querySelectorAll("[data-theme]").forEach((el) => el.setAttribute("data-theme", key));
    }
  }

  function pickTheme(key: string) {
    if (key === selectedTheme) return;
    const previous = selectedTheme;
    setSelectedTheme(key);
    setThemeError(null);
    applyTheme(key);
    startTheme(async () => {
      const res = await updateSalonThemeAction(key);
      if (!res.ok) {
        setThemeError(res.error);
        setSelectedTheme(previous);
        applyTheme(previous);
      }
    });
  }

  // ── Background style ────────────────────────────────────────────
  const [selectedBg, setSelectedBg] = useState(bgStyle);
  const [, startBg] = useTransition();
  const [bgError, setBgError] = useState<string | null>(null);

  function applyBg(key: string) {
    if (typeof document !== "undefined") {
      document.querySelectorAll("[data-bg]").forEach((el) => el.setAttribute("data-bg", key));
    }
  }

  function pickBg(key: string) {
    if (key === selectedBg) return;
    const previous = selectedBg;
    setSelectedBg(key);
    setBgError(null);
    applyBg(key);
    startBg(async () => {
      const res = await updateSalonBgAction(key);
      if (!res.ok) {
        setBgError(res.error);
        setSelectedBg(previous);
        applyBg(previous);
      }
    });
  }

  // ── Unsaved-changes guard (theme saves instantly, so it isn't tracked) ──
  const nameDirty = nameValue.trim() !== savedName.trim();
  const hoursDirty = JSON.stringify(hours) !== JSON.stringify(savedHours);
  const paymentsDirty = JSON.stringify(enabledPayments) !== JSON.stringify(savedPayments);
  useUnsavedChanges(nameDirty || hoursDirty || paymentsDirty);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-brand-500" />
          Configuración del salón
        </h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Edita el nombre y los días y horarios de atención.
        </p>
      </div>

      {/* ── General info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-4 w-4 text-brand-500" />
            Información general
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveName} className="space-y-4">
            <Input
              name="name"
              label="Nombre del salón"
              value={nameValue}
              onChange={(e) => { setNameValue(e.target.value); setNameSaved(false); setNameError(null); }}
              required
              maxLength={120}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" loading={savingName}>
                Guardar nombre
              </Button>
              {nameSaved && (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="h-4 w-4" /> Guardado
                </span>
              )}
            </div>
            {nameError && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {nameError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Business hours ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-500" />
            Metodos de pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-stone-400">
            Escribe cada metodo que acepta tu salon. Por ejemplo: Zinli, efectivo, tarjeta o transferencia.
          </p>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              addPaymentMethod(newPaymentMethod);
            }}
          >
            <input
              value={newPaymentMethod}
              onChange={(event) => {
                setNewPaymentMethod(event.target.value);
                setPaymentsError(null);
                setPaymentsSaved(false);
              }}
              placeholder="Escribe un metodo, ej. Zinli"
              maxLength={64}
              className="h-10 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-brand-500"
            />
            <Button type="submit" variant="primary">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {enabledPayments.map((method) => (
              <span
                key={method}
                className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800"
              >
                {paymentMethodLabel(method)}
                <button
                  type="button"
                  onClick={() => removePaymentMethod(method)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-800"
                  aria-label={`Quitar ${paymentMethodLabel(method)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <span className="text-xs font-medium text-stone-400">Agregar rapido:</span>
            {DEFAULT_PAYMENT_METHOD_OPTIONS
              .filter(
                (method) =>
                  !enabledPayments.some(
                    (enabled) => enabled.toLocaleLowerCase() === method.value.toLocaleLowerCase()
                  )
              )
              .map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => addPaymentMethod(method.value)}
                  className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {method.label}
                </button>
              ))}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={savePaymentMethods} loading={savingPayments}>
              Guardar metodos
            </Button>
            {paymentsSaved && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <Check className="h-4 w-4" /> Metodos actualizados
              </span>
            )}
          </div>
          {paymentsError && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {paymentsError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-500" />
            Días y horarios de atención
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-xs text-stone-400 mb-3">
            Estos horarios definen cuándo se pueden agendar citas. Zona horaria: {timezone}
          </p>

          <div className="divide-y divide-stone-100">
            {hours.map((day) => (
              <div key={day.day_of_week} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-stone-800">{DAY_LABELS[day.day_of_week]}</p>
                </div>

                <button
                  type="button"
                  onClick={() => updateDay(day.day_of_week, { is_open: !day.is_open })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0",
                    day.is_open
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-stone-200 bg-stone-50 text-stone-400 hover:border-stone-300"
                  )}
                >
                  {day.is_open ? "Abierto" : "Cerrado"}
                </button>

                {day.is_open ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.open_time}
                      step={1800}
                      onChange={(e) => updateDay(day.day_of_week, { open_time: e.target.value })}
                      className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <span className="text-stone-400 text-sm">a</span>
                    <input
                      type="time"
                      value={day.close_time}
                      step={1800}
                      onChange={(e) => updateDay(day.day_of_week, { close_time: e.target.value })}
                      className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-stone-400">Sin atención este día</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button variant="primary" onClick={saveHours} loading={savingHours}>
              Guardar horarios
            </Button>
            {hoursSaved && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <Check className="h-4 w-4" /> Horarios actualizados
              </span>
            )}
          </div>
          {hoursError && (
            <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {hoursError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Color theme ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand-500" />
            Gama de colores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-stone-400 mb-4">
            Cambia el color de botones, líneas y acentos del panel. El fondo se mantiene blanco.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const active = selectedTheme === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickTheme(t.key)}
                  className={cn(
                    "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-brand-400 ring-2 ring-brand-400 bg-brand-50"
                      : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-semibold", active ? "text-brand-700" : "text-stone-700")}>
                      {t.label}
                    </span>
                    {active && <Check className="h-4 w-4 text-brand-600" />}
                  </div>
                  <div className="flex gap-1">
                    {t.swatches.map((c) => (
                      <span
                        key={c}
                        className="h-6 flex-1 rounded-md border border-black/5"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {themeError && (
            <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {themeError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Background style ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-brand-500" />
            Fondo del panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-stone-400 mb-4">
            Elige entre un fondo neutro o un fondo de color degradado que combina con la gama seleccionada.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => pickBg("neutral")}
              className={cn(
                "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                selectedBg === "neutral"
                  ? "border-brand-400 ring-2 ring-brand-400 bg-brand-50"
                  : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-semibold", selectedBg === "neutral" ? "text-brand-700" : "text-stone-700")}>
                  Neutro
                </span>
                {selectedBg === "neutral" && <Check className="h-4 w-4 text-brand-600" />}
              </div>
              <div className="h-14 w-full rounded-lg border border-black/5 bg-neutral-100 flex items-center justify-center gap-2 px-2">
                <div className="h-6 w-full rounded-md bg-white border border-stone-200 shadow-sm" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => pickBg("colored")}
              className={cn(
                "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                selectedBg === "colored"
                  ? "border-brand-400 ring-2 ring-brand-400 bg-brand-50"
                  : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-semibold", selectedBg === "colored" ? "text-brand-700" : "text-stone-700")}>
                  De color
                </span>
                {selectedBg === "colored" && <Check className="h-4 w-4 text-brand-600" />}
              </div>
              <div
                className="h-14 w-full rounded-lg flex items-center justify-center gap-2 px-2"
                style={{
                  background: "linear-gradient(150deg, var(--color-brand-300) 0%, var(--color-brand-100) 55%, var(--color-brand-200) 100%)",
                }}
              >
                <div className="h-6 w-full rounded-md bg-white border border-white/60 shadow-sm" />
              </div>
            </button>
          </div>

          {bgError && (
            <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {bgError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
