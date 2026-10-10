"use client";

import { useState } from "react";
import {
  createAppointmentRow,
  type AppointmentServiceRow,
} from "@/features/appointments/domain/wizard-availability";

// Secuencia de claves de fila: única por montaje del asistente.
let rowSeq = 0;
const newRow = (): AppointmentServiceRow => createAppointmentRow(rowSeq++);

/** Filas de servicio/profesional del asistente y arrastre para reordenarlas. */
export function useServiceRows() {
  const [rows, setRows] = useState<AppointmentServiceRow[]>(() => [newRow()]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function updateRow(key: string, patch: Partial<AppointmentServiceRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return prev;
      next.splice(to, 0, moved);
      return next;
    });
  }

  return { rows, dragIndex, setDragIndex, updateRow, addRow, removeRow, reorder };
}
