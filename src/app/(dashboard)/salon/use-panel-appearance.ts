"use client";

import { useState, useTransition } from "react";
import type { Result } from "@/lib/result";
import { updateSalonBgAction, updateSalonThemeAction } from "./actions";

// Atributo de la raíz del panel que cambia al instante. Las muestras de la gama se marcan con
// data-theme-preview y quedan fuera: cada una conserva su propio tema.
const THEME_TARGET = "[data-theme]:not([data-theme-preview])";
const BG_TARGET = "[data-bg]";

function applyAttribute(selector: string, attribute: string, value: string) {
  if (typeof document === "undefined") return;
  document.querySelectorAll(selector).forEach((el) => el.setAttribute(attribute, value));
}

// Selector que aplica el valor al instante, lo guarda en servidor y revierte si el servidor lo rechaza.
function usePanelPicker(
  initial: string,
  target: { selector: string; attribute: string },
  save: (key: string) => Promise<Result<void>>
) {
  const [selected, setSelected] = useState(initial);
  const [, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(key: string) {
    if (key === selected) return;
    const previous = selected;
    setSelected(key);
    setError(null);
    applyAttribute(target.selector, target.attribute, key);
    startSave(async () => {
      const res = await save(key);
      if (!res.ok) {
        setError(res.error);
        setSelected(previous);
        applyAttribute(target.selector, target.attribute, previous);
      }
    });
  }

  return { selected, error, pick };
}

export function useThemePicker(theme: string) {
  return usePanelPicker(theme, { selector: THEME_TARGET, attribute: "data-theme" }, updateSalonThemeAction);
}

export function useBackgroundPicker(bgStyle: string) {
  return usePanelPicker(bgStyle, { selector: BG_TARGET, attribute: "data-bg" }, updateSalonBgAction);
}

export type PanelPickerState = ReturnType<typeof useThemePicker>;
