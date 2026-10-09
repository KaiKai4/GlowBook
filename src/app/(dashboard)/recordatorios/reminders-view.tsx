"use client";

import { useMemo, useState } from "react";
import type { ReminderAppointment, ReminderEmployee } from "@/features/reminders/view-models";
import { tomorrowStr, todayStr } from "./reminder-format";
import { countPendingTomorrow, filterReminders, pendingReminders, type Period } from "./reminder-rules";
import { RemindersSummary } from "./reminders-summary";
import { RemindersFilterBar } from "./reminders-filter-bar";
import { RemindersTable } from "./reminders-table";
import { useReminderActions } from "./use-reminder-actions";

export function RemindersView({
  appointments,
  employees,
  tz,
  salonName,
  template,
  templateId,
}: {
  appointments: ReminderAppointment[];
  employees: ReminderEmployee[];
  tz: string;
  salonName: string;
  template: string;
  templateId?: string;
}) {
  const [period, setPeriod] = useState<Period>("pendientes_hoy");
  const [empId, setEmpId] = useState("");
  const [status, setStatus] = useState("");
  const actions = useReminderActions({ tz, salonName, template, templateId });
  const { manualSentAt } = actions;

  const today = todayStr(tz);
  const tomorrow = tomorrowStr(tz);
  const pending = useMemo(
    () => pendingReminders(appointments, manualSentAt, today, tz),
    [appointments, manualSentAt, today, tz]
  );
  const pendingTomorrowCount = useMemo(
    () => countPendingTomorrow(pending, tomorrow, tz),
    [pending, tomorrow, tz]
  );

  const filtered = useMemo(
    () =>
      filterReminders({
        appointments,
        period,
        empId,
        status,
        manualSentAt,
        today,
        tomorrow,
        tz,
        now: new Date(),
      }),
    [appointments, empId, manualSentAt, period, status, today, tomorrow, tz]
  );

  return (
    <div className="space-y-4">
      <RemindersSummary tomorrowCount={pendingTomorrowCount} weekCount={pending.length} />

      <RemindersFilterBar
        period={period}
        onPeriodChange={setPeriod}
        empId={empId}
        onEmpIdChange={setEmpId}
        status={status}
        onStatusChange={setStatus}
        employees={employees}
      />

      {actions.actionError && (
        <div className="rounded-xl border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger-strong">
          {actions.actionError}
        </div>
      )}

      <RemindersTable rows={filtered} tz={tz} today={today} actions={actions} />
    </div>
  );
}
