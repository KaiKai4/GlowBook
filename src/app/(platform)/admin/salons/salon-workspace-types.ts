export interface SalonWorkspaceSalon {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  isActive: boolean;
  createdAtLabel: string;
  ownerNames: string[];
  customerCount: number;
  collaboratorCount: number;
  appointmentCount: number;
  serviceCount: number;
}

export type SalonTab = "summary" | "usage" | "actions";
