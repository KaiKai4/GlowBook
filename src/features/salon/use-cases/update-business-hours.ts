import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { upsertBusinessHours } from "../data/salon-business-hours.repo";
import type { BusinessDayInput } from "../schemas";

export async function updateBusinessHours(
  salonId: string,
  hours: BusinessDayInput[]
): Promise<Result<void>> {
  const rows = hours.map((day) => ({
    salon_id: salonId,
    day_of_week: day.day_of_week,
    is_open: day.is_open,
    open_time: day.is_open ? day.open_time : null,
    close_time: day.is_open ? day.close_time : null,
  }));

  try {
    await upsertBusinessHours(rows);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "salon", action: "update_business_hours" });
    return { ok: false, error: "Error al guardar los horarios." };
  }
}
