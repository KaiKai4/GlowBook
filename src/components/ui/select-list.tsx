"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import type { SelectOption } from "./select-options";

export interface SelectListPosition {
  top: number;
  left: number;
  width: number;
}

interface SelectListProps {
  listRef: RefObject<HTMLDivElement | null>;
  labelledBy: string;
  position: SelectListPosition;
  options: SelectOption[];
  activeIndex: number;
  selectedValue: string;
  onHoverOption: (index: number) => void;
  onSelectOption: (option: SelectOption) => void;
}

/** Listbox flotante del Select, renderizado en `document.body` mediante portal. */
export function SelectList({
  listRef,
  labelledBy,
  position,
  options,
  activeIndex,
  selectedValue,
  onHoverOption,
  onSelectOption,
}: SelectListProps) {
  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      aria-labelledby={labelledBy}
      style={{ top: position.top, left: position.left, width: position.width }}
      className="fixed z-[80] max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-1.5 shadow-dropdown"
    >
      {options.length === 0 ? (
        <div className="px-3 py-2 text-sm text-fg-subtle">Sin opciones</div>
      ) : null}

      {options.map((option, index) => {
        const active = index === activeIndex;

        return (
          <button
            key={`${option.value}-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === selectedValue}
            disabled={option.disabled}
            onMouseEnter={() => onHoverOption(index)}
            onClick={() => onSelectOption(option)}
            className={cn(
              "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg-secondary transition-colors",
              active && "bg-surface-sunken text-fg-strong",
              option.disabled && "cursor-not-allowed text-fg-disabled hover:bg-transparent"
            )}
          >
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}
