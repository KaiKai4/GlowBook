import {
  hourLabel,
  HOUR_HEIGHT,
  TIME_LABEL_EDGE_SPACE,
  TIME_LABEL_TOP_SPACE,
} from "./calendar-geometry";

const TIME_GUTTER_CLASSES = "sticky left-0 z-20 w-14 shrink-0 border-r border-border bg-surface-muted/95 shadow-sticky";

export function TimeGutter({
  calStart,
  totalHours,
  labelEndHour,
}: {
  calStart: number;
  totalHours: number;
  labelEndHour: number;
}) {
  const labelCount = Math.max(0, Math.min(totalHours, labelEndHour - calStart) + 1);

  return (
    <div className={TIME_GUTTER_CLASSES}>
      <div
        style={{
          height: `${TIME_LABEL_TOP_SPACE + totalHours * HOUR_HEIGHT + TIME_LABEL_EDGE_SPACE}px`,
        }}
        className="relative"
      >
        {Array.from({ length: labelCount }, (_, i) => {
          const { num, period } = hourLabel(calStart + i);
          return (
            <div key={i} style={{ top: `${TIME_LABEL_TOP_SPACE + i * HOUR_HEIGHT}px` }} className="absolute left-0 right-0">
              <span className="absolute -top-2 right-1.5 text-right select-none leading-none">
                <span className="text-xs font-semibold text-fg-secondary tabular-nums">{num}</span>
                <span className="ml-0.5 text-xs font-medium text-fg-subtle">{period}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
