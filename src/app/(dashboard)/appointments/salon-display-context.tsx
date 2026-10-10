"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Datos del salón que la agenda necesita para mostrar horas y mensajes. */
export interface SalonDisplay {
  /** Zona horaria IANA del salón (por ejemplo "America/Panama"). */
  tz: string;
  salonName: string;
}

const SalonDisplayContext = createContext<SalonDisplay | null>(null);

/** Provee tz y nombre del salón a la agenda sin pasarlos por props en cada nivel. */
export function SalonDisplayProvider({
  value,
  children,
}: {
  value: SalonDisplay;
  children: ReactNode;
}) {
  return <SalonDisplayContext.Provider value={value}>{children}</SalonDisplayContext.Provider>;
}

/** Lee tz y nombre del salón. Debe usarse dentro de SalonDisplayProvider. */
export function useSalonDisplay(): SalonDisplay {
  const display = useContext(SalonDisplayContext);
  if (!display) {
    throw new Error("useSalonDisplay debe usarse dentro de SalonDisplayProvider");
  }
  return display;
}
