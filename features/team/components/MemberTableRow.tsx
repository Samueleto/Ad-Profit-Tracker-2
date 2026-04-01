'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import type { WorkspaceMember, WorkspaceRole } from '../types';
import RoleBadge from './RoleBadge';

interface MemberTableRowProps {
  member: WorkspaceMember;
  currentUserId: string;
  currentUserRole: WorkspaceRole;
  onChangeRole: (member: WorkspaceMember) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
  onTransferOwnership: (member: WorkspaceMember) => void;
  onLeave: () => void;
}

function canManage(currentRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (currentRole === 'owner') return targetRole !== 'owner';
  if (currentRole === 'admin') return targetRole === 'member';
  return false;
}

export default function MemberTableRow({
  member, currentUserId, currentUserRole,
  onChangeRole, onRemoveMember, onTransferOwnership, onLeave,
}: MemberTableRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrentUser = member.uid === currentUserId;
  const isOwner = member.workspaceRole === 'owner';
  const showManageActions = !isCurrentUser && canManage(currentUserRole, member.workspaceRole);
  const showTransfer = currentUserRole === 'owner' && member.workspaceRole === 'admin';
  const showLeave = isCurrentUser && currentUserRole !== 'owner';

  let joinDate = '';
  try {
    const ts = member.workspaceJoinedAt as unknown as { seconds: number };
    joinDate = format(new Date(ts.seconds * 1000), 'MMM d, yyyy');
  } catch { joinDate = '—'; }

  const initial = (member.displayName || member.email)?.[0]?.toUpperCase() ?? '?';
  const hasMenu = showManageActions || showTransfer || showLeave;

  return (
    <tr className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {member.photoURL ? (
            <img src={member.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
              {initial}
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{member.displayName || '—'}</p>
            <p className="text-xs text-gray-400">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={member.workspaceRole} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{joinDate}</td>
      <td className="px-4 py-3 relative">
        {hasMenu && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              aria-label="Member actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {showManageActions && (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); onChangeRole(member); }}
                      className="w-full px-3 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Change Role
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onRemoveMember(member); }}
                      className="w-full px-3 py-2 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Remove Member
                    </button>
                  </>
                )}
                {showTransfer && (
                  <button
                    onClick={() => { setMenuOpen(false); onTransferOwnership(member); }}
                    className="w-full px-3 py-2 text-xs text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    Transfer Ownership
                  </button>
                )}
                {showLeave && (
                  <button
                    onClick={() => { setMenuOpen(false); onLeave(); }}
                    className="w-full px-3 py-2 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Leave Workspace
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
