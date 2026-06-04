export interface EmployeeBadge {
  id: string;
  initials: string;
  name: string;
}

export interface ServiceItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  employees: EmployeeBadge[];
}

export interface Category {
  id: string;
  name: string;
  pricing_mode: "fixed" | "variable";
  services: ServiceItem[];
}

export type ServiceStatusFilter = "all" | "active" | "inactive";
