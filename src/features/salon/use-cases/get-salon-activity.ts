import "server-only";

import { findSalonActivity } from "../data/activity-log.repo";
import { describeSalonActivity } from "../domain/activity-messages";

export interface SalonActivityEntry {
  id: string;
  actorEmail: string;
  actionLabel: string;
  recordLabel: string;
  dateLabel: string;
  timeLabel: string;
}

export interface SalonActivityViewModel {
  entries: SalonActivityEntry[];
}

export async function getSalonActivity(): Promise<SalonActivityViewModel> {
  const rows = await findSalonActivity();

  return {
    entries: rows.map((row) => {
      const createdAt = new Date(row.created_at);
      return {
        id: row.id,
        actorEmail: row.actor_email || "sistema",
        actionLabel: describeSalonActivity(row.action, row.table_name),
        recordLabel: row.record_label,
        dateLabel: formatDate(createdAt),
        timeLabel: formatTime(createdAt),
      };
    }),
  };
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
