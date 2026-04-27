import { Check, ChevronDown } from 'lucide-react';
import type { RCAStatus } from '../api/types';
import { statusColors, statusLabels } from '../utils/format';
import Dropdown, { DropdownItem } from './Dropdown';

const ORDER: RCAStatus[] = ['open', 'in_progress', 'rca_done', 'closed'];

interface StatusPickerProps {
  value: RCAStatus;
  onChange: (next: RCAStatus) => void;
  disabled?: boolean;
}

export default function StatusPicker({ value, onChange, disabled = false }: StatusPickerProps) {
  const colors = statusColors[value];

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 px-3 py-1 text-sm transition-all duration-150 ${colors.ring} ${colors.bg} ${colors.text} ${
        disabled ? 'cursor-not-allowed opacity-80' : 'hover:brightness-95 cursor-pointer'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {statusLabels[value]}
      {!disabled && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
    </button>
  );

  if (disabled) return trigger;

  return (
    <Dropdown trigger={trigger} width={180} align="left">
      {(close) => (
        <>
          {ORDER.map((s) => {
            const c = statusColors[s];
            const isActive = s === value;
            return (
              <DropdownItem
                key={s}
                selected={isActive}
                onSelect={() => {
                  onChange(s);
                  close();
                }}
                leading={<span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />}
                trailing={isActive ? <Check className="w-3.5 h-3.5 text-blue-600" /> : null}
              >
                {statusLabels[s]}
              </DropdownItem>
            );
          })}
        </>
      )}
    </Dropdown>
  );
}
