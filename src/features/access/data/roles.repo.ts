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

export async function createRole(salonId: string, name: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .insert({ salon_id: salonId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function setRolePermissions(
  roleId: string,
  salonId: string,
  permissionKeys: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("salon_id", salonId)
    .single();

  if (roleError) throw roleError;
  if (!role) throw new PublicError("Rol no encontrado.");

  const { data: permissions, error: permissionsError } = await supabase
    .from("permissions")
    .select("id, key")
    .in("key", permissionKeys);

  if (permissionsError) throw permissionsError;
  if ((permissions ?? []).length !== permissionKeys.length) {
    throw new PublicError("Uno o mas permisos no existen.");
  }

  const { error: deleteError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("salon_id", salonId);

  if (deleteError) throw deleteError;

  if (permissions && permissions.length > 0) {
    const { error: insertError } = await supabase.from("role_permissions").insert(
      permissions.map((permission) => ({
        role_id: roleId,
        permission_id: permission.id,
        salon_id: salonId,
      }))
    );

    if (insertError) throw insertError;
  }
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
