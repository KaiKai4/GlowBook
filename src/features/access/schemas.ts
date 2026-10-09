import { z } from "@/lib/validation/zod";

export const CreateRoleSchema = z.object({
  name: z.string().min(1, "El nombre del rol es obligatorio").max(100),
  permission_keys: z.array(z.string()).optional().default([]),
});

export const UpdateRolePermissionsSchema = z.object({
  role_id: z.string().uuid(),
  permission_keys: z.array(z.string()),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof UpdateRolePermissionsSchema>;
