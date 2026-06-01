import {
  findOccupiedSlotsForSalonDate,
  type OccupiedByEmployee,
} from "../data/appointment-commands.repo";

export type { OccupiedByEmployee };

// Returns blocking appointment slots grouped by employee for a salon-local date.
// `date` is a YYYY-MM-DD string representing a calendar day in the salon timezone.
export async function getOccupiedSlotsForSalonDate(
  salonId: string,
  date: string,
  excludeAppointmentId?: string
): Promise<OccupiedByEmployee> {
  return findOccupiedSlotsForSalonDate(salonId, date, excludeAppointmentId);
}
