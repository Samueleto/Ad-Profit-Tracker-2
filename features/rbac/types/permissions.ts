export type {
  WorkspaceRole,
  PermissionKey,
  PermissionMap,
  RolePermissionsMatrix,
} from '@/lib/rbac/systemDefaults';

export { PERMISSION_KEYS, EDITABLE_ROLES, SYSTEM_DEFAULTS, mergeWithDefaults } from '@/lib/rbac/systemDefaults';

export interface WorkspacePermissionsDoc {
  id: string;
  workspaceId: string;
  rolePermissions: Partial<import('@/lib/rbac/systemDefaults').RolePermissionsMatrix>;
  customizedRoles: string[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  updatedByUid: string;
}

export interface UserRbacFields {
  workspaceRole: import('@/lib/rbac/systemDefaults').WorkspaceRole;
  effectivePermissions: Partial<import('@/lib/rbac/systemDefaults').PermissionMap>;
  permissionsUpdatedAt: FirebaseFirestore.Timestamp | null;
}

export interface PermissionsMatrixResponse {
  matrix: import('@/lib/rbac/systemDefaults').RolePermissionsMatrix;
  customizedRoles: string[];
  lastUpdatedAt: string | null;
  lastUpdatedByUid: string | null;
}

export interface MyPermissionsResponse {
  role: import('@/lib/rbac/systemDefaults').WorkspaceRole;
  permissions: import('@/lib/rbac/systemDefaults').PermissionMap;
  isCustomized: boolean;
}

export interface PermissionCheckResponse {
  permission: import('@/lib/rbac/systemDefaults').PermissionKey;
  allowed: boolean;
  role: import('@/lib/rbac/systemDefaults').WorkspaceRole;
}
