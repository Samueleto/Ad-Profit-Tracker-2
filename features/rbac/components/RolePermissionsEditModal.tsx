'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { PERMISSION_KEYS, SYSTEM_DEFAULTS } from '@/lib/rbac/systemDefaults';
import type { WorkspaceRole, PermissionKey, PermissionMap, RolePermissionsMatrix } from '@/lib/rbac/systemDefaults';

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

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  canViewDashboard: 'View the main dashboard and KPI metrics',
  canExportData: 'Export data to Excel or PDF',
  canManageApiKeys: 'Add, update, or remove network API keys',
  canSyncNetworks: 'Trigger manual or scheduled data syncs',
  canViewReports: 'View saved and scheduled reports',
  canCreateReports: 'Create and save custom reports',
  canManageTeam: 'Invite members, change roles, manage invitations',
  canViewAuditLogs: 'View the workspace audit log',
  canManageBenchmarks: 'Set and update performance benchmark targets',
};

const CATEGORIES: { label: string; keys: PermissionKey[] }[] = [
  { label: 'Data Access', keys: ['canViewDashboard', 'canExportData'] },
  { label: 'Network Management', keys: ['canSyncNetworks', 'canManageApiKeys'] },
  { label: 'Team Management', keys: ['canManageTeam'] },
  { label: 'Export & Reports', keys: ['canViewReports', 'canCreateReports'] },
  { label: 'Settings', keys: ['canViewAuditLogs', 'canManageBenchmarks'] },
];

type EditableRole = 'admin' | 'member' | 'viewer';
const EDITABLE: EditableRole[] = ['admin', 'member', 'viewer'];

interface RolePermissionsEditModalProps {
  currentUserRole: WorkspaceRole;
  initialMatrix: RolePermissionsMatrix;
  copyFromRole?: WorkspaceRole | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function RolePermissionsEditModal({
  currentUserRole, initialMatrix, copyFromRole, onClose, onSaved
}: RolePermissionsEditModalProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<EditableRole>('member');
  const [perms, setPerms] = useState<Record<EditableRole, PermissionMap>>(() => ({
    admin: { ...SYSTEM_DEFAULTS.admin, ...initialMatrix.admin },
    member: { ...SYSTEM_DEFAULTS.member, ...initialMatrix.member },
    viewer: { ...SYSTEM_DEFAULTS.viewer, ...initialMatrix.viewer },
  }));
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  useEffect(() => {
    if (copyFromRole && EDITABLE.includes(copyFromRole as EditableRole)) {
      const src = initialMatrix[copyFromRole];
      if (src) setPerms(prev => ({ ...prev, [selectedRole]: { ...src } }));
    }
  }, [copyFromRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPerms = perms[selectedRole];
  const allOff = PERMISSION_KEYS.every(k => !currentPerms[k]);

  const toggle = (key: PermissionKey) => {
    setPerms(prev => ({
      ...prev,
      [selectedRole]: { ...prev[selectedRole], [key]: !prev[selectedRole][key] },
    }));
  };

  const getToken = async (refresh = false): Promise<Record<string, string>> => {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken(refresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleSave = async () => {
    if (allOff) return;
    setSaving(true);
    setErrorCode(null);
    try {
      let headers = { ...(await getToken()), 'Content-Type': 'application/json' };
      let res = await fetch('/api/rbac/my-permissions', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ rolePermissions: perms }),
      });
      if (res.status === 401) {
        try { headers = { ...(await getToken(true)), 'Content-Type': 'application/json' }; res = await fetch('/api/rbac/my-permissions', { method: 'PATCH', headers, body: JSON.stringify({ rolePermissions: perms }) }); }
        catch { onClose(); router.push('/'); return; }
        if (res.status === 401) { onClose(); router.push('/'); return; }
      }
      if (!res.ok) { setErrorCode(res.status); return; }
      toast.success('Permissions updated');
      setTimeout(() => onSaved(), 1000);
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const headers = { ...(await getToken()), 'Content-Type': 'application/json' };
      const res = await fetch('/api/rbac/my-permissions', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ resetToDefaults: true }),
      });
      if (res.ok) { toast.success('Reset to defaults'); setTimeout(() => onSaved(), 1000); }
      else setErrorCode(res.status);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Customize Role Permissions</h2>
          <button onClick={() => !saving && onClose()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role selector — admins only see member/viewer (not admin); owners see all */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
            {EDITABLE.filter(role => currentUserRole !== 'admin' || role !== 'admin').map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                disabled={saving}
                className={`px-4 py-1.5 text-xs font-medium rounded-full capitalize transition-colors ${
                  selectedRole === role
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {allOff && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-700 dark:text-amber-300">At least one permission must be enabled.</span>
            </div>
          )}

          {errorCode && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs text-red-700 dark:text-red-300">
                {errorCode === 403 ? 'Only Owners and Admins can edit role permissions' : `Save failed (${errorCode})`}
              </span>
              {errorCode !== 403 && <button onClick={handleSave} className="text-xs text-red-600 underline ml-1">Retry</button>}
            </div>
          )}

{CATEGORIES.map(cat => (
            <div key={cat.label}>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{cat.label}</p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
                {cat.keys.map(key => (
                  <div key={key} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-900">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{PERMISSION_LABELS[key]}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{PERMISSION_DESCRIPTIONS[key]}</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={currentPerms[key]}
                      onClick={() => toggle(key)}
                      disabled={saving}
                      className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                        currentPerms[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                        currentPerms[key] ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button onClick={() => !saving && onClose()} disabled={saving} className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || allOff}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
