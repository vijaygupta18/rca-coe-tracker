import type { RCASeverity } from '../api/types';
import { severityStyles, severityLabels } from './SeverityBadge';

interface SeverityPickerProps {
  value: RCASeverity | null;
  onChange: (v: RCASeverity | null) => void;
  disabled?: boolean;
}

const ORDER: RCASeverity[] = ['sev1', 'sev2', 'sev3'];

export default function SeverityPicker({ value, onChange, disabled = false }: SeverityPickerProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {ORDER.map((s) => {
        const c = severityStyles[s];
        const isActive = value === s;
        const baseClasses =
          'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ring-1 px-2 py-0.5 text-[11px] transition-all';
        const stateClasses = isActive
          ? `${c.solid} text-white ring-transparent shadow-sm`
          : `${c.bg} ${c.text} ${c.ring} hover:brightness-95`;
        const disabledClasses = disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer';
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(isActive ? null : s)}
            className={`${baseClasses} ${stateClasses} ${disabledClasses}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/90' : c.dot}`}
            />
            {severityLabels[s]}
          </button>
        );
      })}
    </div>
  );
}
