import { AlertOctagon, AlertTriangle, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RCASeverity } from '../api/types';

interface SeverityIconProps {
  severity: RCASeverity | null;
  size?: number;
  withLabel?: boolean;
  className?: string;
}

const META: Record<
  RCASeverity,
  { Icon: LucideIcon; color: string; label: string; bg: string }
> = {
  sev1: { Icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50', label: 'SEV1' },
  sev2: { Icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', label: 'SEV2' },
  sev3: { Icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'SEV3' },
};

export default function SeverityIcon({
  severity,
  size = 16,
  withLabel = false,
  className = '',
}: SeverityIconProps) {
  if (!severity) {
    if (withLabel) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-slate-400 ${className}`}
          title="No severity"
        >
          <span
            className="rounded-full border border-dashed border-slate-300"
            style={{ width: size, height: size }}
          />
          <span className="text-[11px] font-medium tracking-wide">—</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-block rounded-full border border-dashed border-slate-300 ${className}`}
        style={{ width: size, height: size }}
        aria-label="No severity"
      />
    );
  }
  const { Icon, color, label } = META[severity];
  if (withLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${color} ${className}`}>
        <Icon style={{ width: size, height: size }} strokeWidth={2.2} />
        <span className="text-[11px] font-semibold tracking-wide">{label}</span>
      </span>
    );
  }
  return (
    <Icon
      className={`${color} ${className}`}
      style={{ width: size, height: size }}
      strokeWidth={2.2}
      aria-label={label}
    />
  );
}
