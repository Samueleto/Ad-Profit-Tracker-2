import type { WorkspaceRole } from '../types';

const COLORS: Record<WorkspaceRole, string> = {
  owner: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  admin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  member: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export default function RoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${COLORS[role]}`}>
      {role}
    </span>
  );
}
