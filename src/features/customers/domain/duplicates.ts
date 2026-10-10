/**
 * Reglas puras de detección de duplicados de clientes.
 * Sin acceso a datos ni a infraestructura: el caso de uso consulta y delega aquí.
 */

export interface DuplicateCandidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_temporary: boolean;
}

export interface ArchivedCustomerMatch {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/** Un cliente temporal (creado desde la agenda) no cuenta como cliente permanente. */
export function isPermanentCandidate(customer: DuplicateCandidate): boolean {
  return !customer.is_temporary;
}

/** Cliente permanente archivado: el que puede restaurarse en lugar de duplicarse. */
function isArchivedPermanentCandidate(customer: DuplicateCandidate): boolean {
  return !customer.is_active && !customer.is_temporary;
}

/** Nombre visible: nombre y apellido sin espacios sobrantes. */
function formatCandidateName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** Primer cliente archivado permanente entre las coincidencias, o null si no hay ninguno. */
export function pickArchivedMatch(
  candidates: ReadonlyArray<DuplicateCandidate | null | undefined>
): ArchivedCustomerMatch | null {
  const archived = candidates.find(
    (customer): customer is DuplicateCandidate =>
      customer != null && isArchivedPermanentCandidate(customer)
  );
  if (!archived) return null;

  return {
    id: archived.id,
    name: formatCandidateName(archived.first_name, archived.last_name),
    phone: archived.phone,
    email: archived.email,
  };
}
