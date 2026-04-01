// Step 148: RBAC system defaults

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

export const PERMISSION_KEYS: PermissionKey[] = [
  'canViewDashboard',
  'canExportData',
  'canManageApiKeys',
  'canSyncNetworks',
  'canViewReports',
  'canCreateReports',
  'canManageTeam',
  'canViewAuditLogs',
  'canManageBenchmarks',
];

export const EDITABLE_ROLES: WorkspaceRole[] = ['admin', 'member', 'viewer', 'analyst'];

export const SYSTEM_DEFAULTS: RolePermissionsMatrix = {
  owner: {
    canViewDashboard: true,
    canExportData: true,
    canManageApiKeys: true,
    canSyncNetworks: true,
    canViewReports: true,
    canCreateReports: true,
    canManageTeam: true,
    canViewAuditLogs: true,
    canManageBenchmarks: true,
  },
  admin: {
    canViewDashboard: true,
    canExportData: true,
    canManageApiKeys: true,
    canSyncNetworks: true,
    canViewReports: true,
    canCreateReports: true,
    canManageTeam: true,
    canViewAuditLogs: true,
    canManageBenchmarks: true,
  },
  member: {
    canViewDashboard: true,
    canExportData: false,
    canManageApiKeys: false,
    canSyncNetworks: true,
    canViewReports: true,
    canCreateReports: false,
    canManageTeam: false,
    canViewAuditLogs: false,
    canManageBenchmarks: false,
  },
  viewer: {
    canViewDashboard: true,
    canExportData: false,
    canManageApiKeys: false,
    canSyncNetworks: false,
    canViewReports: true,
    canCreateReports: false,
    canManageTeam: false,
    canViewAuditLogs: false,
    canManageBenchmarks: false,
  },
  analyst: {
    canViewDashboard: true,
    canExportData: false,
    canManageApiKeys: false,
    canSyncNetworks: false,
    canViewReports: true,
    canCreateReports: true,
    canManageTeam: false,
    canViewAuditLogs: false,
    canManageBenchmarks: true,
  },
};

export function mergeWithDefaults(
  rolePermissions: Partial<RolePermissionsMatrix>
): RolePermissionsMatrix {
  const result = {} as RolePermissionsMatrix;

  for (const role of Object.keys(SYSTEM_DEFAULTS) as WorkspaceRole[]) {
    const defaults = SYSTEM_DEFAULTS[role];
    const provided = rolePermissions[role] || {};
    result[role] = { ...defaults, ...provided } as PermissionMap;
  }

  return result;
}
