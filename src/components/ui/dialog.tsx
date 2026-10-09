"use client";

import { useEffect, useId } from "react";
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

export function Dialog({
  open, onClose, title, description, children, className, dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
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
