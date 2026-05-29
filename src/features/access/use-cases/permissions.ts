import { PERMISSION_CATALOG } from "../domain/permissions";

const VALID_PERMISSION_KEYS = new Set<string>(
  PERMISSION_CATALOG.map((permission) => permission.key)
);

export function hasOnlyKnownPermissionKeys(permissionKeys: string[]): boolean {
  return permissionKeys.every((permissionKey) => VALID_PERMISSION_KEYS.has(permissionKey));
}

export function uniquePermissionKeys(permissionKeys: string[]): string[] {
  return [...new Set(permissionKeys)];
}
