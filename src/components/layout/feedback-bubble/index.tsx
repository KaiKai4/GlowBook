"use client";

import { useState, useTransition } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FeedbackCategory } from "@/features/feedback/schemas";
import { FeedbackPanel } from "./panel";
import type { SubmitFeedbackAction } from "./types";

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
        />
      )}

      <button
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-all hover:scale-105",
          open ? "bg-stone-700 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
        )}
        aria-label="Reportar a soporte"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
