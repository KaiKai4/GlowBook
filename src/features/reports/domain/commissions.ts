import type { ReportAppointmentItem } from "./metrics";

export interface EmployeeCommission {
  employeeId: string;
  name: string;
  /** Citas completadas distintas atendidas en el periodo. */
  appointments: number;
  /** Ingresos generados por ese empleado (servicios cobrados). */
  revenue: number;
  /** % de comisión aplicado. */
  commissionPct: number;
  /** Comisión a pagar = revenue * commissionPct / 100. */
  commission: number;
}

export interface CommissionReport {
  rows: EmployeeCommission[];
  totalRevenue: number;
  totalCommission: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Liquidación de comisiones por empleado a partir de los items completados del
 * periodo. El % usado es el vigente del empleado (no se versiona por cita);
 * para un salón que cambia comisiones rara vez, es la lectura correcta y
 * predecible. Empleados con 0% aparecen igual, con comisión 0.
 */
export function calculateCommissionReport(items: ReportAppointmentItem[]): CommissionReport {
  const byEmployee = new Map<
    string,
    { name: string; appointmentIds: Set<string>; revenue: number; commissionPct: number }
  >();

  for (const item of items) {
    if (!item.employeeId || !item.employeeName) continue;

    const entry = byEmployee.get(item.employeeId) ?? {
      name: item.employeeName,
      appointmentIds: new Set<string>(),
      revenue: 0,
      commissionPct: item.employeeCommissionPct,
    };
    entry.appointmentIds.add(item.appointmentId);
    entry.revenue += Number(item.price ?? 0);
    // El % es por empleado; el ultimo item refresca por si vino vacio antes.
    entry.commissionPct = item.employeeCommissionPct;
    byEmployee.set(item.employeeId, entry);
  }

  const rows: EmployeeCommission[] = [...byEmployee.entries()]
    .map(([employeeId, entry]) => {
      const revenue = round2(entry.revenue);
      return {
        employeeId,
        name: entry.name,
        appointments: entry.appointmentIds.size,
        revenue,
        commissionPct: entry.commissionPct,
        commission: round2((revenue * entry.commissionPct) / 100),
      };
    })
    .sort((a, b) => b.commission - a.commission || b.revenue - a.revenue || a.name.localeCompare(b.name));

  return {
    rows,
    totalRevenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)),
    totalCommission: round2(rows.reduce((sum, row) => sum + row.commission, 0)),
  };
}
