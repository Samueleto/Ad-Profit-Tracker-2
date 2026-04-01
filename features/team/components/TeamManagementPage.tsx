'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, UserPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch, SessionExpiredError } from '@/lib/auth/teamAuthFetch';
import { getAuth } from 'firebase/auth';
import type { WorkspaceMember, WorkspaceMetadata, WorkspaceInvitationSafe } from '../types';
import RoleBadge from './RoleBadge';
import MemberTableRow from './MemberTableRow';
import PendingInvitationRow from './PendingInvitationRow';
import MemberTableSkeleton from './MemberTableSkeleton';
import InvitationTableSkeleton from './InvitationTableSkeleton';
import ConfirmDialog from './ConfirmDialog';
import RoleSelector from './RoleSelector';
import InviteMemberModal from './InviteMemberModal';
import PermissionsTab from '@/features/rbac/components/PermissionsTab';

type FetchState = 'loading' | 'success' | 'error_403' | 'error_404' | 'error_500';
type TeamTab = 'members' | 'permissions';

export default function TeamManagementPage() {
  const [activeTab, setActiveTab] = useState<TeamTab>('members');
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationSafe[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceMetadata | null>(null);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<null | {
    title: string; message: string; confirmLabel: string; onConfirm: () => Promise<void>;
  }>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<WorkspaceMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');

  const router = useRouter();
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid ?? '';

  const fetchAll = useCallback(async () => {
    setFetchState('loading');
    try {
      const [membersRes, invitesRes, wsRes] = await Promise.all([
        authFetch('/api/team/members'),
        authFetch('/api/team/invitations'),
        authFetch('/api/team/workspace'),
      ]);
      if (membersRes.status === 403) { setFetchState('error_403'); return; }
      if (membersRes.status === 404) { setFetchState('error_404'); return; }
      if (!membersRes.ok) { setFetchState('error_500'); return; }

      const [membersData, invitesData, wsData] = await Promise.all([
        membersRes.json(),
        invitesRes.ok ? invitesRes.json() : { invitations: [] },
        wsRes.ok ? wsRes.json() : null,
      ]);

      setMembers(membersData.members ?? []);
      setInvitations(invitesData.invitations ?? []);
      setWorkspace(wsData?.workspace ?? null);
      setWorkspaceName(wsData?.workspace?.workspaceName ?? '');
      setFetchState('success');
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        toast.error('Session expired. Please sign in again.');
        router.push('/');
      } else {
        setFetchState('error_500');
      }
    }
  }, [router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const currentUserRole = members.find(m => m.uid === currentUserId)?.workspaceRole ?? 'member';

  const handleSaveWorkspaceName = async () => {
    if (!workspaceName.trim()) return;
    setSavingName(true);
    const previousName = workspace?.workspaceName ?? '';
    try {
      const res = await authFetch('/api/team/workspace', {
        method: 'PATCH',
        body: JSON.stringify({ workspaceName: workspaceName.trim() }),
      });
      if (!res.ok) {
        setWorkspaceName(previousName);
        toast.error('Something went wrong. Please try again.');
      } else {
        setEditingName(false);
      }
    } catch {
      setWorkspaceName(previousName);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangeRole = (member: WorkspaceMember) => {
    setRoleChangeTarget(member);
    setSelectedRole(member.workspaceRole === 'admin' ? 'admin' : 'member');
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return;
    const prevMembers = members;
    try {
      const res = await authFetch(`/api/team/members/${roleChangeTarget.uid}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: selectedRole }),
      });
      setRoleChangeTarget(null);
      if (!res.ok) {
        toast.error('Something went wrong. Please try again.');
        setMembers(prevMembers);
      } else {
        fetchAll();
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
      setMembers(prevMembers);
      setRoleChangeTarget(null);
    }
  };

  const handleRemoveMember = (member: WorkspaceMember) => {
    setConfirmDialog({
      title: 'Remove Member',
      message: `Remove ${member.displayName || member.email} from this workspace?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        const prevMembers = members;
        try {
          const res = await authFetch(`/api/team/members/${member.uid}`, { method: 'DELETE' });
          setConfirmDialog(null);
          if (!res.ok) {
            toast.error('Something went wrong. Please try again.');
            setMembers(prevMembers);
          } else {
            fetchAll();
          }
        } catch {
          toast.error('Something went wrong. Please try again.');
          setMembers(prevMembers);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleTransferOwnership = (member: WorkspaceMember) => {
    setConfirmDialog({
      title: 'Transfer Ownership',
      message: `Transfer ownership to ${member.displayName || member.email}? You will become an Admin.`,
      confirmLabel: 'Transfer',
      onConfirm: async () => {
        const prevMembers = members;
        try {
          const res = await authFetch(`/api/team/members/${member.uid}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'owner' }),
          });
          setConfirmDialog(null);
          if (!res.ok) {
            toast.error('Something went wrong. Please try again.');
            setMembers(prevMembers);
          } else {
            fetchAll();
          }
        } catch {
          toast.error('Something went wrong. Please try again.');
          setMembers(prevMembers);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleLeave = () => {
    setConfirmDialog({
      title: 'Leave Workspace',
      message: 'Are you sure you want to leave this workspace?',
      confirmLabel: 'Leave',
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/team/members/${currentUserId}`, { method: 'DELETE' });
          setConfirmDialog(null);
          if (!res.ok) {
            toast.error('Something went wrong. Please try again.');
          } else {
            router.replace('/dashboard');
          }
        } catch {
          toast.error('Something went wrong. Please try again.');
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleRevokeInvitation = (invitation: WorkspaceInvitationSafe) => {
    setConfirmDialog({
      title: 'Revoke Invitation',
      message: `Revoke invitation for ${invitation.invitedEmail}?`,
      confirmLabel: 'Revoke',
      onConfirm: async () => {
        const prevInvitations = invitations;
        try {
          const res = await authFetch(`/api/team/invitations/${invitation.id}`, { method: 'DELETE' });
          setConfirmDialog(null);
          if (!res.ok) {
            toast.error('Something went wrong. Please try again.');
            setInvitations(prevInvitations);
          } else {
            fetchAll();
          }
        } catch {
          toast.error('Something went wrong. Please try again.');
          setInvitations(prevInvitations);
          setConfirmDialog(null);
        }
      },
    });
  };

  if (fetchState === 'error_403') {
    return (
      <div className="p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-medium text-gray-900 dark:text-white">Access Denied</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You do not have permission to manage this workspace.
        </p>
        <a href="/dashboard" className="inline-block text-sm text-blue-600 hover:underline">
          Go to Dashboard
        </a>
      </div>
    );
  }

  if (fetchState === 'error_404') {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Workspace not found</p>
        <a href="/dashboard" className="inline-block text-sm text-blue-600 hover:underline">
          Go to Dashboard
        </a>
      </div>
    );
  }

  if (fetchState === 'error_500') {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400 flex-1">Failed to load team data.</span>
        <button onClick={fetchAll} className="text-xs text-red-700 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['members', 'permissions'] as TeamTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-4 text-sm font-medium border-b-2 capitalize transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'permissions' && (
        <PermissionsTab currentUserRole={currentUserRole} />
      )}

      {activeTab === 'members' && (<>
      {/* Workspace Settings (collapsible) */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setWorkspaceSettingsOpen(v => !v)}
          className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Workspace Settings
          <ChevronDown className={`w-4 h-4 transition-transform ${workspaceSettingsOpen ? 'rotate-180' : ''}`} />
        </button>
        {workspaceSettingsOpen && (
          <div className="px-4 py-4 bg-white dark:bg-gray-900 space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Workspace Name</label>
              {currentUserRole === 'owner' && editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={100}
                  />
                  <button
                    onClick={handleSaveWorkspaceName}
                    disabled={savingName}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-xs text-gray-500">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {workspace?.workspaceName ?? '—'}
                  </span>
                  {currentUserRole === 'owner' && (
                    <button onClick={() => setEditingName(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Member Roster */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Members</h3>
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Member
            </button>
          )}
        </div>

        {fetchState === 'loading' ? (
          <MemberTableSkeleton />
        ) : members.length === 1 && members[0].uid === currentUserId ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              You are the only member. Invite your team to collaborate.
            </p>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Invite Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Member</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Joined</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {members.map(member => (
                  <MemberTableRow
                    key={member.uid}
                    member={member}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onChangeRole={handleChangeRole}
                    onRemoveMember={handleRemoveMember}
                    onTransferOwnership={handleTransferOwnership}
                    onLeave={handleLeave}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pending Invitations</h3>
        </div>
        {fetchState === 'loading' ? (
          <InvitationTableSkeleton />
        ) : invitations.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No pending invitations.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Invited By</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Sent</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Expires</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invitations.map(inv => (
                  <PendingInvitationRow
                    key={inv.id}
                    invitation={inv}
                    currentUserRole={currentUserRole}
                    onRevoke={handleRevokeInvitation}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Workspace (non-owners) */}
      {currentUserRole !== 'owner' && fetchState === 'success' && (
        <div className="text-right">
          <button
            onClick={handleLeave}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Leave Workspace
          </button>
        </div>
      )}

      </>)}

      {/* Role change modal */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRoleChangeTarget(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Change role for {roleChangeTarget.displayName || roleChangeTarget.email}
            </h3>
            <RoleSelector value={selectedRole} onChange={setSelectedRole} />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setRoleChangeTarget(null)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleConfirmRoleChange} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Invite modal */}
      {inviteModalOpen && (
        <InviteMemberModal
          workspaceName={workspace?.workspaceName ?? 'Your Workspace'}
          onClose={() => setInviteModalOpen(false)}
          onSuccess={() => { setInviteModalOpen(false); fetchAll(); }}
        />
      )}
    </div>
  );
}
