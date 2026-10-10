/** Datos mínimos del profesional necesarios para decidir si puede realizar un servicio. */
export interface EligibilityEmployee {
  service_ids: string[];
  category_ids: string[];
}

/** Datos mínimos del servicio necesarios para la elegibilidad. */
export interface EligibilityService {
  id: string;
  category_id: string;
}

/**
 * ¿Puede este profesional realizar este servicio? Exige que el servicio esté entre
 * los suyos y que su categoría esté entre las categorías que atiende.
 * Única implementación de la regla: la usan el agendado y el asistente de citas.
 */
export function isEligible(employee: EligibilityEmployee, service: EligibilityService): boolean {
  return (
    employee.service_ids.includes(service.id) &&
    employee.category_ids.includes(service.category_id)
  );
}
