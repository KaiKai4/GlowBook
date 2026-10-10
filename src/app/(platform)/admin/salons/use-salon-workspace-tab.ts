"use client";

import { useState } from "react";
import type { SalonSubscriptionDetail } from "@/features/billing/use-cases/salon-subscription-detail";
import type { SalonTab } from "./salon-workspace-types";

/**
 * Pestaña activa del espacio del salón y número de límites con aviso
 * (se muestra como insignia en la pestaña "Plan y uso").
 */
export function useSalonWorkspaceTab(detail: SalonSubscriptionDetail) {
  const [tab, setTab] = useState<SalonTab>("summary");
  const warningCount = detail.limits.filter((limit) => limit.warningLevel !== "none").length;

  return { tab, setTab, warningCount };
}
