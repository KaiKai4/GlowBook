// Datos de ejemplo realistas para los tests de conducta de la UI de personas.
import type { Database } from "@/types/database.types";
import type { Category, ServiceItem } from "@/app/(dashboard)/services/services-types";

export function buildService(overrides: Partial<ServiceItem> = {}): ServiceItem {
  return {
    id: "svc-1",
    category_id: "cat-1",
    name: "Corte de cabello",
    description: "Corte clásico con lavado",
    duration_minutes: 45,
    price: 15,
    is_active: true,
    employees: [],
    ...overrides,
  };
}

export function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Cabello",
    pricing_mode: "fixed",
    services: [buildService()],
    ...overrides,
  };
}

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export function buildCustomerRow(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    birth_date: null,
    created_at: "2026-01-10T12:00:00.000Z",
    email: "ana@example.com",
    first_name: "Ana",
    id: "cust-1",
    is_active: true,
    is_temporary: false,
    last_name: "Vega",
    notes: "",
    phone: "60001234",
    salon_id: "salon-1",
    search_name: "ana vega",
    updated_at: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}
