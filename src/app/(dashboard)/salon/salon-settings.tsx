"use client";

import Link from "next/link";
import { History, Settings } from "lucide-react";
import { useUnsavedChanges } from "@/components/layout/unsaved-changes";
import { PageHeader } from "@/components/ui/page-header";
import type { PaymentMethod } from "@/features/payments/domain/payment-methods";
import type { SalonBusinessDay as BusinessDay } from "@/features/salon";
import { useSalonName } from "./use-salon-name";
import { useBusinessHours } from "./use-business-hours";
import { usePaymentMethods } from "./use-payment-methods";
import { useBackgroundPicker, useThemePicker } from "./use-panel-appearance";
import { SalonGeneralCard } from "./salon-general-card";
import { SalonPaymentsCard } from "./salon-payments-card";
import { SalonHoursCard } from "./salon-hours-card";
import { SalonThemeCard } from "./salon-theme-card";
import { SalonBackgroundCard } from "./salon-background-card";

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
  const name = useSalonName(salonName);
  const hours = useBusinessHours(businessHours);
  const payments = usePaymentMethods(paymentMethods);
  const themePicker = useThemePicker(theme);
  const bgPicker = useBackgroundPicker(bgStyle);

  // El tema y el fondo se guardan al instante, así que no entran en el control de cambios pendientes.
  useUnsavedChanges(name.dirty || hours.dirty || payments.dirty);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-brand-500" aria-hidden="true" />
            Configuración del salón
          </span>
        }
        description="Edita el nombre y los días y horarios de atención."
        actions={
          <Link
            href="/salon/actividad"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-100 bg-surface px-4 text-sm font-semibold text-fg-secondary shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            <History className="h-4 w-4" />
            Log de actividad
          </Link>
        }
      />

      <SalonGeneralCard name={name} />
      <SalonPaymentsCard payments={payments} />
      <SalonHoursCard timezone={timezone} hours={hours} />
      <SalonThemeCard theme={themePicker} />
      <SalonBackgroundCard bg={bgPicker} />
    </div>
  );
}
