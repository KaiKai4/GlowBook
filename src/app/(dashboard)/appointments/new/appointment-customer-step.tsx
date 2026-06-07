"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { normalizeOptionalPhoneInput } from "@/lib/utils/phone";
import { UserPlus, Users } from "lucide-react";
import type { CustomerOption } from "./appointment-wizard-types";

export function AppointmentCustomerStep({
  customers,
  mode,
  setMode,
  customerId,
  setCustomerId,
  newFirst,
  setNewFirst,
  newLast,
  setNewLast,
  newPhone,
  setNewPhone,
  error,
  checkingPhone,
  onContinue,
  clearError,
}: {
  customers: CustomerOption[];
  mode: "existing" | "new";
  setMode: (mode: "existing" | "new") => void;
  customerId: string;
  setCustomerId: (customerId: string) => void;
  newFirst: string;
  setNewFirst: (firstName: string) => void;
  newLast: string;
  setNewLast: (lastName: string) => void;
  newPhone: string;
  setNewPhone: (phone: string) => void;
  error: string | null;
  checkingPhone: boolean;
  onContinue: () => void;
  clearError: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
          <Users className="h-4 w-4 text-brand-600" />
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
            onClick={() => {
              clearError();
              setMode("existing");
            }}
            disabled={customers.length === 0}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border-2 p-4 text-sm font-medium transition-all disabled:opacity-40",
              mode === "existing"
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
            )}
          >
            <Users className="h-4 w-4" /> Cliente existente
          </button>
          <button
            type="button"
            onClick={() => {
              clearError();
              setMode("new");
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border-2 p-4 text-sm font-medium transition-all",
              mode === "new"
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
            )}
          >
            <UserPlus className="h-4 w-4" /> Cliente nuevo
          </button>
        </div>

        {mode === "existing" ? (
          <Select
            label="Cliente"
            placeholder="Selecciona un cliente..."
            value={customerId}
            onChange={(event) => {
              clearError();
              setCustomerId(event.target.value);
            }}
          >
            <option value="" disabled hidden>
              Selecciona un cliente...
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nombre"
                value={newFirst}
                onChange={(event) => {
                  clearError();
                  setNewFirst(event.target.value);
                }}
              />
              <Input
                label="Apellido"
                value={newLast}
                onChange={(event) => {
                  clearError();
                  setNewLast(event.target.value);
                }}
              />
            </div>
            <Input
              label="Celular (opcional)"
              type="tel"
              inputMode="numeric"
              maxLength={14}
              placeholder="60000000"
              value={newPhone}
              onChange={(event) => {
                clearError();
                setNewPhone(normalizeOptionalPhoneInput(event.target.value));
              }}
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            size="lg"
            onClick={onContinue}
            loading={checkingPhone}
            disabled={mode === "existing" ? !customerId : false}
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
