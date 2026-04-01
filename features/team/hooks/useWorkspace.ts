'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch, SessionExpiredError } from '@/lib/auth/teamAuthFetch';
import type { WorkspaceMetadata } from '../types';

export interface UseWorkspaceResult {
  workspace: WorkspaceMetadata | null;
  workspaceName: string;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  updateWorkspaceName: (name: string) => Promise<void>;
}

export function useWorkspace(): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<WorkspaceMetadata | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await authFetch('/api/team/workspace');
      if (!res.ok) { setError('Failed to load workspace.'); return; }
      const data = await res.json();
      const ws: WorkspaceMetadata = data.workspace ?? data;
      setWorkspace(ws);
      setWorkspaceName(ws.workspaceName ?? '');
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setSessionExpired(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load workspace.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkspace(); }, [fetchWorkspace]);

  const updateWorkspaceName = useCallback(async (name: string) => {
    const previousName = workspaceName;
    // Optimistic update
    setWorkspaceName(name);
    setWorkspace(prev => prev ? { ...prev, workspaceName: name } : prev);
    try {
      const res = await authFetch('/api/team/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ workspaceName: name }),
      });
      if (!res.ok) {
        // Rollback
        setWorkspaceName(previousName);
        setWorkspace(prev => prev ? { ...prev, workspaceName: previousName } : prev);
      }
    } catch {
      // Rollback
      setWorkspaceName(previousName);
      setWorkspace(prev => prev ? { ...prev, workspaceName: previousName } : prev);
    }
  }, [workspaceName]);

  return { workspace, workspaceName, loading, error, sessionExpired, updateWorkspaceName };
}
