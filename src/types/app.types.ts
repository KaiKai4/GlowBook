// Application-level types derived from the database schema.
// These are the "rich" types used across features.

export interface ProfileWithRole {
  id: string;
  salon_id: string;
  role_id: string | null;
  is_owner: boolean;
  full_name: string;
  is_active: boolean;
  salon?: {
    disabled_features: string[] | null;
  } | null;
  role?: {
    id: string;
    name: string;
    role_permissions: Array<{
      permission: { id: string; key: string; description: string } | null;
    }>;
  } | null;
}
