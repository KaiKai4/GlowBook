"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";

// Primitiva de popover: panel flotante anclado a un disparador, renderizado en
// `document.body`. Gestiona posición, cierre (clic fuera y Escape), foco al abrir
// y retorno del foco al disparador al cerrar.

const VIEWPORT_MARGIN = 12;

export interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

interface TriggerRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

interface PopoverFrame {
  width: number;
  height: number;
  gap: number;
}

/**
 * Calcula dónde colocar el panel: debajo del disparador si cabe (o si el disparador está
 * demasiado arriba para ponerlo encima), si no encima; siempre dentro del viewport.
 * Función pura: no lee el DOM.
 */
function computePopoverPosition(
  rect: TriggerRect,
  viewport: { width: number; height: number },
  frame: PopoverFrame
): PopoverPosition {
  const fitsBelow = viewport.height - rect.bottom >= frame.height || rect.top < frame.height;
  const rawTop = fitsBelow ? rect.bottom + frame.gap : rect.top - frame.height - frame.gap;
  const left = Math.min(
    Math.max(rect.left, VIEWPORT_MARGIN),
    viewport.width - frame.width - VIEWPORT_MARGIN
  );

  return {
    top: Math.max(VIEWPORT_MARGIN, rawTop),
    left,
    width: frame.width,
  };
}

/** Atributos ARIA del disparador: aria-expanded siempre; aria-controls solo mientras el panel existe. */
export function popoverTriggerAria(open: boolean, panelId: string, role: "dialog" | "listbox" = "dialog") {
  return {
    "aria-haspopup": role,
    "aria-expanded": open,
    "aria-controls": open ? panelId : undefined,
  };
}

interface PopoverProps {
  open: boolean;
  onDismiss: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  panelId: string;
  role?: "dialog" | "listbox";
  // Nombre accesible del panel: aria-label o, para listbox, el id de su etiqueta.
  label?: string;
  labelledBy?: string;
  // Ancho fijo; si no se indica, el panel mide lo mismo que el disparador.
  width?: number;
  height: number;
  gap?: number;
  // El foco entra en el panel al abrir (diálogos de calendario); false mantiene el foco en el disparador (listbox con teclado).
  focusOnOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function Popover({
  open,
  onDismiss,
  triggerRef,
  panelId,
  role = "dialog",
  label,
  labelledBy,
  width,
  height,
  gap = 8,
  focusOnOpen = true,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const position = usePopoverPosition(triggerRef, open, { width, height, gap });
  usePopoverDismiss({ open, onDismiss, triggerRef, panelRef });
  usePopoverFocus({ open, focusOnOpen, triggerRef, panelRef });

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      data-popover-panel=""
      tabIndex={focusOnOpen ? -1 : undefined}
      style={{ top: position.top, left: position.left, width: position.width }}
      className={cn("fixed z-[80]", className)}
    >
      {children}
    </div>,
    document.body
  );
}

function usePopoverPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  frame: { width: number | undefined; height: number; gap: number }
): PopoverPosition {
  const { width: fixedWidth, height, gap } = frame;
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0, width: fixedWidth ?? 0 });

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPosition(
        computePopoverPosition(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          { width: fixedWidth ?? rect.width, height, gap }
        )
      );
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef, fixedWidth, height, gap]);

  return position;
}

interface DismissOptions {
  open: boolean;
  onDismiss: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
}

function usePopoverDismiss({ open, onDismiss, triggerRef, panelRef }: DismissOptions) {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onDismiss();
    };
    // Captura: el Escape llega antes que los listeners de diálogos (que comprueban defaultPrevented).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onDismiss, triggerRef, panelRef]);
}

interface FocusOptions {
  open: boolean;
  focusOnOpen: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
}

function usePopoverFocus({ open, focusOnOpen, triggerRef, panelRef }: FocusOptions) {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      if (focusOnOpen) panelRef.current?.focus();
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    // Al desmontarse el panel, el foco que tenía se pierde (queda en body): lo devolvemos al disparador.
    // Si el usuario llevó el foco a otro control, no se lo quitamos.
    const active = document.activeElement;
    if (!active || active === document.body) triggerRef.current?.focus();
  }, [open, focusOnOpen, triggerRef, panelRef]);
}
