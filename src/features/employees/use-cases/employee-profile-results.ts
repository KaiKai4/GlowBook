// Tipos de resultado de los casos de uso de perfil de colaborador (alta, edicion y busqueda de archivados).

export interface CreateEmployeeResult {
  id: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  /** La escritura se confirmo, pero un efecto posterior (p. ej. el enlace de acceso) fallo. */
  warnings?: string[];
}

export interface EmployeeWriteResult {
  /** La escritura se confirmo, pero un efecto posterior fallo. */
  warnings?: string[];
}

export interface ArchivedEmployeeMatch {
  id: string;
  name: string;
  email: string;
}
