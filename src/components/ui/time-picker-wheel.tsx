import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;
const COPIES = 7;
const CENTER_COPY = Math.floor(COPIES / 2);

export function InfiniteWheel({
  label,
  values,
  selected,
  format,
  onSelect,
}: {
  label: string;
  values: number[];
  selected: number;
  format: (value: number) => string;
  onSelect: (value: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  const items = useMemo(
    () =>
      Array.from({ length: COPIES }, (_, copy) =>
        values.map((value, index) => ({ copy, index, value }))
      ).flat(),
    [values]
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const selectedIndex = values.indexOf(selectedRef.current);
    if (!scroller || selectedIndex < 0) return;

    scroller.scrollTop =
      (CENTER_COPY * values.length +
        selectedIndex -
        Math.floor(VISIBLE_ITEMS / 2)) *
      ITEM_HEIGHT;
  }, [values]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );

  function readCenteredValue() {
    const scroller = scrollerRef.current;
    if (!scroller) return null;

    const absoluteIndex =
      Math.round(scroller.scrollTop / ITEM_HEIGHT) +
      Math.floor(VISIBLE_ITEMS / 2);
    const logicalIndex = ((absoluteIndex % values.length) + values.length) % values.length;
    const value = values[logicalIndex];
    if (value === undefined) return null;
    return { absoluteIndex, logicalIndex, value };
  }

  function handleScroll() {
    const centered = readCenteredValue();
    if (!centered) return;

    if (centered.value !== selectedRef.current) {
      selectedRef.current = centered.value;
      onSelect(centered.value);
    }

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const current = readCenteredValue();
      const scroller = scrollerRef.current;
      if (!current || !scroller) return;

      const copy = Math.floor(current.absoluteIndex / values.length);
      if (copy <= 1 || copy >= COPIES - 2) {
        scroller.scrollTop =
          (CENTER_COPY * values.length +
            current.logicalIndex -
            Math.floor(VISIBLE_ITEMS / 2)) *
          ITEM_HEIGHT;
      }
    }, 90);
  }

  return (
    <div
      ref={scrollerRef}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        scrollerRef.current?.scrollBy({
          top: event.key === "ArrowUp" ? -ITEM_HEIGHT : ITEM_HEIGHT,
          behavior: "smooth",
        });
      }}
      className="time-picker-wheel relative z-10 h-[180px] overflow-y-auto focus:outline-none"
    >
      {items.map(({ copy, index, value }) => {
        const accessible = copy === CENTER_COPY;
        const active = value === selected;

        return (
          <button
            key={`${copy}-${index}`}
            type="button"
            role={accessible ? "option" : undefined}
            aria-selected={accessible ? active : undefined}
            aria-hidden={accessible ? undefined : true}
            tabIndex={-1}
            onClick={(event) => {
              selectedRef.current = value;
              onSelect(value);
              scrollerRef.current?.scrollTo({
                top:
                  event.currentTarget.offsetTop -
                  Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT,
                behavior: "smooth",
              });
            }}
            className={cn(
              "flex h-9 w-full snap-center items-center justify-center text-base transition-[color,opacity] duration-150",
              active
                ? "font-semibold text-fg"
                : "font-medium text-fg-subtle"
            )}
          >
            {format(value)}
          </button>
        );
      })}
    </div>
  );
}
