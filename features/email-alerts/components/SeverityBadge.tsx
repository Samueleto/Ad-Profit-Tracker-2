export type Severity = 'error' | 'warning' | 'success' | 'info';

const COLORS: Record<Severity, string> = {
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

interface SeverityBadgeProps {
  severity: Severity;
}

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${COLORS[severity]}`}>
      {severity}
    </span>
  );
}
