'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import type {
  WorkspaceRole,
  PermissionKey,
  PermissionMap,
  RolePermissionsMatrix,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFreshToken(): Promise<string | undefined> {
  return getAuth().currentUser?.getIdToken();
}

function buildHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// ─── checkPermission utility ──────────────────────────────────────────────────

export function checkPermission(
  permissions: Partial<PermissionMap> | null | undefined,
  key: PermissionKey
): boolean {
  if (!permissions) return false;
  return permissions[key] === true;
}

// ─── useRolePermissions ───────────────────────────────────────────────────────

export interface UseRolePermissionsResult {
  rolePermissions: RolePermissionsMatrix | null;
  customizedRoles: WorkspaceRole[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRolePermissions(): UseRolePermissionsResult {
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMatrix | null>(null);
  const [customizedRoles, setCustomizedRoles] = useState<WorkspaceRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await getFreshToken();
        const res = await fetch('/api/rbac/permissions', { headers: buildHeaders(token) });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        if (fetchId !== fetchIdRef.current) return;
        setRolePermissions(data.rolePermissions ?? null);
        setCustomizedRoles(data.customizedRoles ?? []);
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load permissions.');
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    })();
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { rolePermissions, customizedRoles, loading, error, refresh };
}

// ─── useMyPermissions ─────────────────────────────────────────────────────────

export interface UseMyPermissionsResult {
  permissions: PermissionMap | null;
  workspaceRole: WorkspaceRole | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
}

export function useMyPermissions(): UseMyPermissionsResult {
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getFreshToken();
        const res = await fetch('/api/rbac/my-permissions', { headers: buildHeaders(token) });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        setPermissions(data.permissions ?? null);
        setWorkspaceRole(data.workspaceRole ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load your permissions.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isOwner = workspaceRole === 'owner';

  return { permissions, workspaceRole, isOwner, loading, error };
}

// ─── useRolePermissionsEditDraft ──────────────────────────────────────────────
// Local draft state for the RolePermissionsEditModal.

export interface UseRolePermissionsEditDraftResult {
  selectedRole: WorkspaceRole;
  setSelectedRole: (role: WorkspaceRole) => void;
  draft: Partial<PermissionMap>;
  toggleDraftPermission: (key: PermissionKey, value: boolean) => void;
  saving: boolean;
  validationErrors: Record<string, string>;
  save: (
    onSave: (role: WorkspaceRole, permissions: Partial<PermissionMap>) => Promise<void>
  ) => Promise<void>;
  reset: (rolePermissions: RolePermissionsMatrix | null) => void;
}

export function useRolePermissionsEditDraft(
  initialRole: WorkspaceRole,
  rolePermissions: RolePermissionsMatrix | null
): UseRolePermissionsEditDraftResult {
  const [selectedRole, setSelectedRoleState] = useState<WorkspaceRole>(initialRole);
  const [draft, setDraft] = useState<Partial<PermissionMap>>(() =>
    rolePermissions?.[initialRole] ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const setSelectedRole = useCallback(
    (role: WorkspaceRole) => {
      setSelectedRoleState(role);
      // Reset draft to fetched values for newly selected role
      setDraft(rolePermissions?.[role] ?? {});
      setValidationErrors({});
    },
    [rolePermissions]
  );

  const toggleDraftPermission = useCallback((key: PermissionKey, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const save = useCallback(
    async (onSave: (role: WorkspaceRole, permissions: Partial<PermissionMap>) => Promise<void>) => {
      setSaving(true);
      setValidationErrors({});
      try {
        await onSave(selectedRole, draft);
      } catch (err) {
        if (err instanceof Error && 'fieldErrors' in (err as unknown as Record<string, unknown>)) {
          setValidationErrors(((err as unknown as { fieldErrors: Record<string, string> }).fieldErrors) ?? {});
        }
      } finally {
        setSaving(false);
      }
    },
    [selectedRole, draft]
  );

  const reset = useCallback(
    (matrix: RolePermissionsMatrix | null) => {
      setDraft(matrix?.[selectedRole] ?? {});
      setValidationErrors({});
    },
    [selectedRole]
  );

  return {
    selectedRole,
    setSelectedRole,
    draft,
    toggleDraftPermission,
    saving,
    validationErrors,
    save,
    reset,
  };
}
