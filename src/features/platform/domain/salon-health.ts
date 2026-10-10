// Salud operativa de un salón vista desde la plataforma: un salón activo que
// lleva semanas sin agendar es riesgo de churn y merece contacto antes de que
// cancele. La referencia es la ultima cita; si nunca agendo, su creacion.

const DORMANT_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isDormantSalon(input: {
  isActive: boolean;
  createdAt: string;
  lastAppointmentAt: string | null;
  now: Date;
  dormantAfterDays?: number;
}): boolean {
  if (!input.isActive) return false;

  const reference = input.lastAppointmentAt ?? input.createdAt;
  const referenceTime = new Date(reference).getTime();
  if (Number.isNaN(referenceTime)) return false;

  const days = (input.now.getTime() - referenceTime) / DAY_MS;
  return days > (input.dormantAfterDays ?? DORMANT_AFTER_DAYS);
}
