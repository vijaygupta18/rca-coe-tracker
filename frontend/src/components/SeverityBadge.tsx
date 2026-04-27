import { useEffect, useRef, useState } from 'react';
import type { RCASeverity } from '../api/types';

interface SeverityBadgeProps {
  severity: RCASeverity | null;
  size?: 'sm' | 'md';
}

export const severityStyles: Record<
  RCASeverity,
  { bg: string; text: string; ring: string; dot: string; solid: string }
> = {
  sev1: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-200',
    dot: 'bg-red-500',
    solid: 'bg-red-600',
  },
  sev2: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    ring: 'ring-orange-200',
    dot: 'bg-orange-500',
    solid: 'bg-orange-500',
  },
  sev3: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    ring: 'ring-yellow-200',
    dot: 'bg-yellow-500',
    solid: 'bg-yellow-500',
  },
};

export const severityLabels: Record<RCASeverity, string> = {
  sev1: 'SEV1',
  sev2: 'SEV2',
  sev3: 'SEV3',
};

export default function SeverityBadge({ severity, size = 'sm' }: SeverityBadgeProps) {
  const [pulse, setPulse] = useState(false);
  const lastValue = useRef<RCASeverity | null>(severity);

  useEffect(() => {
    if (lastValue.current !== severity && severity != null) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 420);
      lastValue.current = severity;
      return () => window.clearTimeout(t);
    }
    lastValue.current = severity;
  }, [severity]);

  if (!severity) return null;
  const colors = severityStyles[severity];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ring-1 ${colors.ring} ${colors.bg} ${colors.text} ${sizeClasses} ${
        pulse ? 'animate-badge-pulse' : ''
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {severityLabels[severity]}
    </span>
  );
}
