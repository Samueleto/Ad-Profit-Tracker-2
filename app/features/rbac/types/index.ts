// Step 148: TypeScript types for RBAC system

import type { Timestamp } from 'firebase-admin/firestore';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer' | 'analyst';

export type PermissionKey =
  | 'canViewDashboard'
  | 'canExportData'
  | 'canManageApiKeys'
  | 'canSyncNetworks'
  | 'canViewReports'
  | 'canCreateReports'
  | 'canManageTeam'
  | 'canViewAuditLogs'
  | 'canManageBenchmarks';

export type PermissionMap = Record<PermissionKey, boolean>;
export type RolePermissionsMatrix = Record<WorkspaceRole, PermissionMap>;

export interface WorkspacePermissionsDoc {
  id: string;
  workspaceId: string;
  rolePermissions: Partial<Record<Exclude<WorkspaceRole, 'owner'>, Partial<PermissionMap>>>;
  customizedRoles: WorkspaceRole[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedByUid: string;
}

export interface UserRbacFields {
  workspaceRole: WorkspaceRole;
  effectivePermissions: Partial<PermissionMap>;
  permissionsUpdatedAt: Timestamp | null;
}

export interface PermissionsMatrixResponse {
  rolePermissions: RolePermissionsMatrix;
  customizedRoles: WorkspaceRole[];
  updatedAt: string | null;
}

export interface MyPermissionsResponse {
  workspaceRole: WorkspaceRole;
  permissions: PermissionMap;
  isCustomized: boolean;
}

export interface PermissionCheckResponse {
  allowed: boolean;
  permission: PermissionKey;
  role: WorkspaceRole;
}
