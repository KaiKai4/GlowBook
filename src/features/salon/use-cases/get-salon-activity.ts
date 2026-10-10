import { formatClockTime } from "@/infra/format/es-formats";
import "server-only";

import { formatDate } from "@/infra/format/dates";
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

export async function getSalonActivity(salonId: string): Promise<SalonActivityViewModel> {
  const rows = await findSalonActivity(salonId);

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

function formatTime(value: Date): string {
  return formatClockTime(value);
}
