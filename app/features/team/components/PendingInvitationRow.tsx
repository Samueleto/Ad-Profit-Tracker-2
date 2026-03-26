import { format } from 'date-fns';
import type { WorkspaceInvitationSafe, WorkspaceRole } from '../types';

interface PendingInvitationRowProps {
  invitation: WorkspaceInvitationSafe;
  currentUserRole: WorkspaceRole;
  onRevoke: (invitation: WorkspaceInvitationSafe) => void;
}

function fmtTimestamp(ts: unknown): string {
  try {
    const t = ts as { seconds: number };
    return format(new Date(t.seconds * 1000), 'MMM d, yyyy');
  } catch { return '—'; }
}

export default function PendingInvitationRow({ invitation, currentUserRole, onRevoke }: PendingInvitationRowProps) {
  const canRevoke = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <tr className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="px-4 py-3 text-xs text-gray-800 dark:text-gray-200">{invitation.invitedEmail}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{invitation.invitedByName}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{fmtTimestamp(invitation.createdAt)}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{fmtTimestamp(invitation.expiresAt)}</td>
      <td className="px-4 py-3">
        {canRevoke && (
          <button
            onClick={() => onRevoke(invitation)}
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}
