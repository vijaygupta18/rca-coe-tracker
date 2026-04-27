import { useState } from 'react';
import { Check } from 'lucide-react';
import type { RCAStatus } from '../api/types';
import { statusColors, statusLabels } from '../utils/format';
import ConfirmDialog from './ConfirmDialog';

interface StatusStepperProps {
  value: RCAStatus;
  onChange?: (next: RCAStatus) => void;
  canEdit?: boolean;
  pending?: boolean;
}

const ORDER: RCAStatus[] = ['open', 'in_progress', 'rca_done', 'closed'];

export default function StatusStepper({
  value,
  onChange,
  canEdit = false,
  pending = false,
}: StatusStepperProps) {
  const currentIdx = ORDER.indexOf(value);
  const [pendingBackward, setPendingBackward] = useState<RCAStatus | null>(null);

  return (
    <ol
      className="flex items-stretch w-full gap-0 select-none"
      role="list"
      aria-label="RCA status"
    >
      {ORDER.map((status, idx) => {
        const colors = statusColors[status];
        const isCurrent = idx === currentIdx;
        const isCompleted = idx < currentIdx;
        const isFuture = idx > currentIdx;
        const interactive = canEdit && !pending && !isCurrent;

        const onClick = () => {
          if (!interactive) return;
          const movingBackward = idx < currentIdx;
          if (movingBackward) {
            setPendingBackward(status);
            return;
          }
          onChange?.(status);
        };

        const baseClasses = isCurrent
          ? `${colors.bg} ${colors.text} ring-1 ${colors.ring} shadow-sm`
          : isCompleted
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-white text-slate-400 border border-dashed border-slate-300';

        const dotInner = isCurrent ? (
          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        ) : isCompleted ? (
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        );

        const dotWrapper = isCompleted
          ? 'bg-emerald-500'
          : isCurrent
          ? 'bg-white ring-2 ring-current'
          : 'bg-slate-100';

        return (
          <li key={status} className="flex-1 flex items-center min-w-0">
            <button
              type="button"
              onClick={onClick}
              disabled={!interactive}
              aria-current={isCurrent ? 'step' : undefined}
              className={`relative flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${baseClasses} ${
                interactive
                  ? 'cursor-pointer hover:brightness-95 active:scale-[0.98]'
                  : isFuture && canEdit
                  ? 'cursor-pointer hover:brightness-95'
                  : 'cursor-default'
              } ${pending && isCurrent ? 'animate-pulse' : ''}`}
              title={
                !canEdit
                  ? statusLabels[status]
                  : isCurrent
                  ? `Current: ${statusLabels[status]}`
                  : `Move to ${statusLabels[status]}`
              }
            >
              <span
                className={`shrink-0 w-3.5 h-3.5 rounded-full inline-flex items-center justify-center ${dotWrapper}`}
              >
                {dotInner}
              </span>
              <span className="truncate">{statusLabels[status]}</span>
            </button>
            {idx < ORDER.length - 1 && (
              <span
                aria-hidden
                className={`shrink-0 h-px w-3 mx-0.5 ${
                  idx < currentIdx ? 'bg-emerald-300' : 'bg-slate-200'
                }`}
              />
            )}
          </li>
        );
      })}
      <ConfirmDialog
        open={pendingBackward !== null}
        onClose={() => setPendingBackward(null)}
        onConfirm={() => {
          const target = pendingBackward;
          setPendingBackward(null);
          if (target) onChange?.(target);
        }}
        variant="primary"
        title={`Move status back to ${pendingBackward ? statusLabels[pendingBackward] : ''}?`}
        description={
          pendingBackward
            ? `This RCA is currently "${statusLabels[value]}". Moving it back to "${statusLabels[pendingBackward]}" will reopen it and the lifecycle timestamps will reflect the change in the history. This is reversible.`
            : ''
        }
        confirmLabel={pendingBackward ? `Move back to ${statusLabels[pendingBackward]}` : 'Confirm'}
        cancelLabel="Stay on current status"
      />
    </ol>
  );
}
