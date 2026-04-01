'use client';

type InviteRole = 'admin' | 'member';

const DESCRIPTIONS: Record<InviteRole, string> = {
  admin: 'Can invite members, manage roles, and access all workspace features',
  member: 'Can access workspace features but cannot manage team settings',
};

interface RoleSelectorProps {
  value: InviteRole;
  onChange: (role: InviteRole) => void;
}

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['admin', 'member'] as InviteRole[]).map(role => (
        <button
          key={role}
          onClick={() => onChange(role)}
          className={`text-left px-3 py-3 rounded-xl border-2 transition-colors ${
            value === role
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <p className={`text-xs font-semibold capitalize mb-1 ${
            value === role ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
          }`}>
            {role}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{DESCRIPTIONS[role]}</p>
        </button>
      ))}
    </div>
  );
}
