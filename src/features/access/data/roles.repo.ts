import "server-only";
import { PublicError } from "@/infra/public-error";
import { createSupabaseServerClient } from "@/infra/supabase/server";

export interface RoleWithPermissions {
  id: string;
  salon_id: string;
  name: string;
  is_system: boolean;
  role_permissions: Array<{
    permission: { id: string; key: string; description: string } | null;
  }>;
}

export async function findRolesWithPermissions(salonId: string): Promise<RoleWithPermissions[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select(`
      id, salon_id, name, is_system,
      role_permissions(permission:permissions(id, key, description))
    `)
    .eq("salon_id", salonId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RoleWithPermissions[];
}

export async function findAllPermissions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("permissions").select("*").order("key");
  if (error) throw error;
  return data ?? [];
}

export async function deleteRole(roleId: string, salonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .eq("salon_id", salonId)
    .single();

  if (roleError) throw roleError;
  if (!role) throw new PublicError("Rol no encontrado.");
  if (role.is_system) throw new PublicError("Los roles de sistema no se pueden eliminar.");

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("salon_id", salonId);

  if (error) throw error;
}
