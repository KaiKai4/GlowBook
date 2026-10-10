/**
 * Cadena select compartida del detalle de colaborador: columnas propias más servicios,
 * categorías y horarios anidados. La usan las lecturas de listado y de ficha.
 */
export const EMPLOYEE_DETAIL_SELECT = `
      *,
      services:employee_services(service:services(id, name, duration_minutes, price)),
      categories:employee_categories(category:service_categories(id, name)),
      work_schedules(id, day_of_week, start_time, end_time, is_active)
    `;
