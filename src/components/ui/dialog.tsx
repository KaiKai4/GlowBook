"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/components/ui/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  // False while a critical request is in flight: Escape, overlay click and the X
  // button must not close the dialog and lose the pending result.
  dismissible?: boolean;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open, onClose, title, description, children, className, dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // onClose en una referencia: un padre que lo recrea en cada render no reinicia el foco.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Al cerrar, el foco vuelve a lo que tenía enfocado antes de abrir (normalmente el botón que lo abrió).
    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Solo el diálogo superior gestiona el foco: con dos diálogos abiertos (p. ej. una
    // confirmación sobre un formulario) se pelearían por el foco en bucle.
    const isTop = () => panel !== null && openPanels[openPanels.length - 1] === panel;
    if (panel) openPanels.push(panel);

    const onKey = (e: KeyboardEvent) => {
      // Un popover abierto dentro del diálogo consume el Escape (defaultPrevented).
      if (e.key === "Escape" && dismissible && !e.defaultPrevented) {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && isTop()) trapTab(e, panel);
    };
    // Foco que sale del diálogo (salvo a un popover flotante del propio diálogo) vuelve dentro.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!isTop() || !(target instanceof Node) || panel?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-popover-panel]")) return;
      focusFirst(panel);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    document.body.style.overflow = "hidden";
    if (!panel?.contains(document.activeElement)) focusFirst(panel);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      if (panel) openPanels.splice(openPanels.indexOf(panel), 1);
      document.body.style.overflow = "";
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [open, dismissible]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-fg/40 backdrop-blur-sm"
        onClick={requestClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl bg-surface shadow-xl",
          "max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <div className="flex items-start justify-between border-b border-border-subtle p-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
            {description && <p id={descriptionId} className="mt-0.5 text-sm text-fg-subtle">{description}</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={!dismissible}
            className="rounded-lg p-1 text-fg-subtle hover:bg-surface-sunken hover:text-fg-muted disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Paneles de los diálogos abiertos, del primero al último (el último es el superior).
const openPanels: HTMLElement[] = [];

function focusableIn(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Primer elemento enfocable; si no hay ninguno, el propio diálogo.
function focusFirst(panel: HTMLElement | null) {
  if (!panel) return;
  const [first] = focusableIn(panel);
  (first ?? panel).focus();
}

// Tab y Shift+Tab ciclan dentro del diálogo.
function trapTab(event: KeyboardEvent, panel: HTMLElement | null) {
  const items = focusableIn(panel);
  if (items.length === 0 || !panel) {
    event.preventDefault();
    panel?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !(active instanceof Node) || !panel.contains(active);

  if (event.shiftKey && (active === first || active === panel || outside)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first?.focus();
  }
}
