import { Input } from "@/components/ui/input";
import { splitServiceDuration } from "@/features/services/domain/duration";

export function ServiceDurationFields({
  defaultValue = 30,
}: {
  defaultValue?: number;
}) {
  const duration = splitServiceDuration(defaultValue);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-stone-700">Duración</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="duration_hours"
          label="Horas"
          type="number"
          min={0}
          step={1}
          defaultValue={duration.hours}
          inputMode="numeric"
          required
        />
        <Input
          name="duration_minutes_part"
          label="Minutos"
          type="number"
          min={0}
          max={59}
          step={1}
          defaultValue={duration.minutes}
          inputMode="numeric"
          required
        />
      </div>
      <p className="mt-1.5 text-xs text-stone-500">
        Usa minutos entre 0 y 59. Ejemplo: 1 hora y 50 minutos.
      </p>
    </fieldset>
  );
}
