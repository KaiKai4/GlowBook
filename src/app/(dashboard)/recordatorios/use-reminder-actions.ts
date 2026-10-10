"use client";

import { useState, useTransition } from "react";
import type { ReminderAppointment } from "@/features/reminders";
import { buildReminderMessage, buildWhatsAppUrl } from "./reminder-format";
import { useReminderSubmissions } from "./use-reminder-submissions";

export interface ReminderActionsParams {
  tz: string;
  salonName: string;
  template: string;
  templateId?: string;
}

// Estado y acciones de la vista de recordatorios: copiar, WhatsApp, marcar enviado y confirmar.
export function useReminderActions({ tz, salonName, template, templateId }: ReminderActionsParams) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [readyToConfirm, setReadyToConfirm] = useState<Record<string, boolean>>({});
  const [manualStatus, setManualStatus] = useState<Record<string, string>>({});
  const [manualSentAt, setManualSentAt] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const { markSent, confirm } = useReminderSubmissions();

  function messageFor(appt: ReminderAppointment): string {
    return buildReminderMessage({ appt, tz, salonName, template });
  }

  async function copyMessage(appt: ReminderAppointment) {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(messageFor(appt));
      setCopiedId(appt.id);
      setReadyToConfirm((current) => ({ ...current, [appt.id]: true }));
      setTimeout(() => setCopiedId((current) => (current === appt.id ? null : current)), 1800);
    } catch {
      setActionError("No se pudo copiar el mensaje. Revisa permisos del navegador.");
    }
  }

  function openWhatsApp(appt: ReminderAppointment) {
    if (!appt.customer?.phone) return;
    window.open(buildWhatsAppUrl(appt.customer.phone, messageFor(appt)), "_blank", "noopener,noreferrer");
    setReadyToConfirm((current) => ({ ...current, [appt.id]: true }));
  }

  function markAsSent(appt: ReminderAppointment) {
    setActionError(null);
    setSendingId(appt.id);

    startTransition(async () => {
      const result = await markSent(appt.id, templateId);
      setSendingId(null);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      setManualSentAt((current) => ({ ...current, [appt.id]: result.value }));
      setReadyToConfirm((current) => ({ ...current, [appt.id]: true }));
    });
  }

  function confirmAppointment(appt: ReminderAppointment) {
    setActionError(null);
    setConfirmingId(appt.id);

    startTransition(async () => {
      const result = await confirm(appt.id);
      setConfirmingId(null);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      setManualStatus((current) => ({ ...current, [appt.id]: "confirmed" }));
    });
  }

  return {
    copiedId,
    actionError,
    sendingId,
    confirmingId,
    openActionsId,
    readyToConfirm,
    manualStatus,
    manualSentAt,
    isPending,
    setOpenActionsId,
    copyMessage,
    openWhatsApp,
    markAsSent,
    confirmAppointment,
  };
}

export type ReminderActions = ReturnType<typeof useReminderActions>;
