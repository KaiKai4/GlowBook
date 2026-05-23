"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateNav({ date }: { date: string }) {
  const router = useRouter();

  function go(value: string) {
    router.push(`/appointments?date=${value}`);
  }
  function shift(days: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    go(toISODate(d));
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => shift(-1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
        aria-label="Día anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => go(e.target.value)}
        className="h-10 rounded-lg border border-stone-200 px-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
      />
      <button
        onClick={() => shift(1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
        aria-label="Día siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <Button variant="outline" size="sm" onClick={() => go(toISODate(new Date()))}>
        Hoy
      </Button>
    </div>
  );
}
