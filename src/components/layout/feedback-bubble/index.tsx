"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FeedbackCategory } from "@/features/feedback/schemas";
import { FeedbackPanel } from "./panel";
import type { SubmitFeedbackAction } from "./types";

const BUBBLE_SIZE = 56;
const VIEWPORT_PADDING = 24;
const PANEL_WIDTH = 352;
const PANEL_HEIGHT = 390;
const PANEL_GAP = 12;
const STORAGE_KEY = "glowbook.feedbackBubblePosition";

function defaultPosition() {
  if (typeof window === "undefined") return { left: 24, top: 24 };

  return {
    left: window.innerWidth - VIEWPORT_PADDING - BUBBLE_SIZE,
    top: window.innerHeight - VIEWPORT_PADDING - BUBBLE_SIZE,
  };
}

function clampPosition(position: { left: number; top: number }) {
  if (typeof window === "undefined") return position;

  return {
    left: Math.min(
      Math.max(position.left, VIEWPORT_PADDING),
      window.innerWidth - VIEWPORT_PADDING - BUBBLE_SIZE
    ),
    top: Math.min(
      Math.max(position.top, VIEWPORT_PADDING),
      window.innerHeight - VIEWPORT_PADDING - BUBBLE_SIZE
    ),
  };
}

export function FeedbackBubble({
  submitFeedbackAction,
}: {
  submitFeedbackAction: SubmitFeedbackAction;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();
  // null hasta montar: la posicion depende de window/localStorage y renderizarla
  // en SSR provocaria un hydration mismatch.
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const dragRef = useRef({
    active: false,
    pointerId: 0,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0,
    moved: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { left: number; top: number };
          setPosition(clampPosition(parsed));
          return;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      setPosition(defaultPosition());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        if (!current) return current;
        const next = clampPosition(current);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const panelPosition = useMemo(() => {
    if (typeof window === "undefined" || !position) return undefined;

    const panelWidth = Math.min(window.innerWidth - VIEWPORT_PADDING * 2, PANEL_WIDTH);
    const left = Math.min(
      Math.max(position.left + BUBBLE_SIZE - panelWidth, VIEWPORT_PADDING),
      window.innerWidth - VIEWPORT_PADDING - panelWidth
    );
    const preferredTop = position.top - PANEL_HEIGHT - PANEL_GAP;
    const fallbackTop = position.top + BUBBLE_SIZE + PANEL_GAP;
    const top =
      preferredTop >= VIEWPORT_PADDING
        ? preferredTop
        : Math.min(
            fallbackTop,
            window.innerHeight - VIEWPORT_PADDING - Math.min(PANEL_HEIGHT, window.innerHeight - VIEWPORT_PADDING * 2)
          );

    return { left, top: Math.max(VIEWPORT_PADDING, top) };
  }, [position]);

  function reset() {
    setMessage("");
    setCategory("bug");
    setError(null);
    setSent(false);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  function handleSend() {
    setError(null);
    startSubmit(async () => {
      const result = await submitFeedbackAction({ category, message });
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  const moveTo = useCallback((left: number, top: number) => {
    const next = clampPosition({ left, top });
    setPosition(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !position) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }

    moveTo(drag.originLeft + deltaX, drag.originTop + deltaY);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (drag.active && drag.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      drag.active = false;
    }
  }

  if (!position) return null;

  return (
    <>
      {open && (
        <FeedbackPanel
          category={category}
          message={message}
          sent={sent}
          error={error}
          pending={pending}
          onCategoryChange={setCategory}
          onMessageChange={(value) => {
            setMessage(value);
            setError(null);
          }}
          onClose={close}
          onSend={handleSend}
          position={panelPosition}
        />
      )}

      <button
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(event) => {
          if (dragRef.current.moved) {
            event.preventDefault();
            dragRef.current.moved = false;
            return;
          }
          if (open) close();
          else setOpen(true);
        }}
        style={{ left: position.left, top: position.top }}
        className={cn(
          "fixed z-50 flex h-14 w-14 touch-none cursor-grab items-center justify-center rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-[background-color,color,box-shadow,transform] active:cursor-grabbing hover:scale-105",
          open ? "bg-fg-secondary text-surface" : "bg-brand-600 text-surface hover:bg-brand-700"
        )}
        aria-label="Reportar a soporte"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
