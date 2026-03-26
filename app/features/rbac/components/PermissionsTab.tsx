'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ChevronDown, AlertTriangle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { PERMISSION_KEYS, SYSTEM_DEFAULTS } from '@/lib/rbac/systemDefaults';
import type { WorkspaceRole, PermissionKey, RolePermissionsMatrix } from '@/lib/rbac/systemDefaults';

interface MyPermissionsResponse {
  role: WorkspaceRole;
  permissions: Record<PermissionKey, boolean>;
  isCustomized: boolean;
}
import RolePermissionsEditModal from './RolePermissionsEditModal';

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  canViewDashboard: 'Dashboard View',
  canExportData: 'Export Data',
  canManageApiKeys: 'Manage API Keys',
  canSyncNetworks: 'Sync Networks',
  canViewReports: 'View Reports',
  canCreateReports: 'Create Reports',
  canManageTeam: 'Manage Team',
  canViewAuditLogs: 'View Audit Logs',
  canManageBenchmarks: 'Manage Benchmarks',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-indigo-700 dark:text-indigo-400',
  admin: 'text-blue-700 dark:text-blue-400',
  member: 'text-gray-600 dark:text-gray-400',
  viewer: 'text-teal-700 dark:text-teal-400',
};

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  admin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  member: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  viewer: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full access to all features. Can transfer ownership, manage billing, and delete the workspace.',
  admin: 'Broad access. Can invite members, customize roles, and manage most workspace settings.',
  member: 'Standard access. Can view dashboard, sync networks, and run reports. Cannot manage team or export data.',
  viewer: 'Read-only access. Can view dashboard and reports but cannot make changes or export.',
};

const DISPLAY_ROLES: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

interface PermissionsTabProps {
  currentUserRole: WorkspaceRole;
}

export default function PermissionsTab({ currentUserRole }: PermissionsTabProps) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<RolePermissionsMatrix | null>(null);
  const [myPerms, setMyPerms] = useState<MyPermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [copyRole, setCopyRole] = useState<WorkspaceRole | null>(null);

  const getToken = useCallback(async (refresh = false): Promise<Record<string, string>> => {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken(refresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      let headers = await getToken();
      const [r1, r2] = await Promise.all([
        fetch('/api/rbac/my-permissions', { headers }),
        fetch('/api/rbac/my-permissions', { headers }),
      ]);
      // Fetch matrix
      let matrixRes = await fetch('/api/rbac/my-permissions', { headers });
      if (matrixRes.status === 401) {
        try { headers = await getToken(true); matrixRes = await fetch('/api/rbac/my-permissions', { headers }); }
        catch { router.push('/'); return; }
        if (matrixRes.status === 401) { router.push('/'); return; }
      }
      if (!matrixRes.ok) { setErrorCode(matrixRes.status); setMatrix(SYSTEM_DEFAULTS); }
      else {
        const data: MyPermissionsResponse = await matrixRes.json();
        setMyPerms(data);
      }
      setMatrix(SYSTEM_DEFAULTS);
    } catch {
      setErrorCode(500);
      setMatrix(SYSTEM_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canCustomize = currentUserRole === 'owner' || currentUserRole === 'admin';
  const resolvedMatrix = matrix ?? SYSTEM_DEFAULTS;

  return (
    <div className="space-y-6">
      {/* Role badge legend */}
      <div className="flex flex-wrap gap-2">
        {DISPLAY_ROLES.map(role => (
          <span key={role} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ROLE_BADGE[role]}`}>
            {role}
          </span>
        ))}
      </div>

      {/* Error banner */}
      {errorCode && errorCode !== 401 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300 flex-1">
            {errorCode === 403 ? 'Access Denied — insufficient permissions to view role matrix'
              : errorCode === 404 ? 'Permissions configuration not found'
              : 'Failed to load permissions'}
          </span>
          <button onClick={fetchData} className="text-xs text-red-600 underline">Retry</button>
        </div>
      )}

      {/* Permissions matrix */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="sticky left-0 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400 min-w-[180px]">
                Permission
              </th>
              {DISPLAY_ROLES.map(role => (
                <th key={role} className={`px-4 py-2.5 text-center font-semibold capitalize ${ROLE_COLORS[role]}`}>
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {loading
              ? PERMISSION_KEYS.map(key => (
                  <tr key={key} className="animate-pulse">
                    <td className="sticky left-0 bg-white dark:bg-gray-900 px-4 py-2">
                      <div className="h-2.5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                    </td>
                    {DISPLAY_ROLES.map(r => (
                      <td key={r} className="px-4 py-2 text-center">
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
                      </td>
                    ))}
                  </tr>
                ))
              : PERMISSION_KEYS.map(key => (
                  <tr key={key} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="sticky left-0 bg-white dark:bg-gray-900 px-4 py-2 font-medium text-gray-700 dark:text-gray-300">
                      {PERMISSION_LABELS[key]}
                    </td>
                    {DISPLAY_ROLES.map(role => {
                      const granted = resolvedMatrix[role]?.[key] ?? false;
                      return (
                        <td key={role} className="px-4 py-2 text-center">
                          {granted
                            ? <Check className="w-3.5 h-3.5 text-green-500 mx-auto" />
                            : <X className="w-3.5 h-3.5 text-red-400 mx-auto" />
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Role descriptions accordion */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setRolesOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 text-left"
        >
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Role Descriptions</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${rolesOpen ? 'rotate-180' : ''}`} />
        </button>
        {rolesOpen && (
          <div className="px-4 py-3 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-700/50">
            {DISPLAY_ROLES.map(role => (
              <div key={role} className="py-2">
                <span className={`text-xs font-semibold capitalize ${ROLE_COLORS[role]}`}>{role}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Effective permissions */}
      {myPerms && (
        <div>
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Your Effective Permissions</h3>
          <div className="grid grid-cols-2 gap-2">
            {PERMISSION_KEYS.map(key => {
              const granted = myPerms.permissions[key] ?? false;
              return (
                <div key={key} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {granted
                    ? <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                    : <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                  }
                  <span className="text-xs text-gray-600 dark:text-gray-400">{PERMISSION_LABELS[key]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {canCustomize && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Customize Role Permissions
          </button>
          {currentUserRole === 'owner' && (
            <select
              value={copyRole ?? ''}
              onChange={e => { setCopyRole(e.target.value as WorkspaceRole); setEditModalOpen(true); }}
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="">Copy role...</option>
              {(['admin', 'member', 'viewer'] as WorkspaceRole[]).map(r => (
                <option key={r} value={r}>Copy {r}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {editModalOpen && (
        <RolePermissionsEditModal
          currentUserRole={currentUserRole}
          initialMatrix={resolvedMatrix}
          copyFromRole={copyRole}
          onClose={() => { setEditModalOpen(false); setCopyRole(null); }}
          onSaved={() => { setEditModalOpen(false); setCopyRole(null); fetchData(); }}
        />
      )}
    </div>
  );
}
