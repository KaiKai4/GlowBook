export interface EmployeeListItem {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile_id: string | null;
  serviceCount: number;
  categories: string[];
  categoryIds: string[];
}

export interface CategoryOption {
  id: string;
  name: string;
  services: { id: string; name: string }[];
}

export interface RoleOption {
  id: string;
  name: string;
}

// Sin token: la DB solo guarda el hash, asi que el enlace de una invitación
// existente no puede volver a mostrarse — solo regenerarse.
export interface PendingEmployeeInvitation {
  expiresAt: string;
  roleId: string | null;
}
