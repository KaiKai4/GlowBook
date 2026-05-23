import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // Resolve keys to permission IDs
  const { data: perms } = await supabase
    .from("permissions")
    .select("id, key")
    .in("key", permissionKeys);

  // Replace all permissions for this role
  await supabase.from("role_permissions").delete().eq("role_id", roleId);

  if (perms && perms.length > 0) {
    await supabase.from("role_permissions").insert(
      perms.map((p) => ({ role_id: roleId, permission_id: p.id, salon_id: salonId }))
    );
  }
}

export async function assignRoleToProfile(
  profileId: string,
  roleId: string,
  salonId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Verify role belongs to the salon
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("salon_id", salonId)
    .single();

  if (!role) throw new Error("El rol no pertenece a este salón.");

  const { error } = await supabase
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", profileId)
    .eq("salon_id", salonId);

  if (error) throw error;
}

export async function deleteRole(roleId: string, salonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // System roles (Owner) cannot be deleted
  const { data: role } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .eq("salon_id", salonId)
    .single();

  if (!role) throw new Error("Rol no encontrado.");
  if (role.is_system) throw new Error("Los roles de sistema no se pueden eliminar.");

  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) throw error;
}
