import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  pending?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  pending = false,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';
  const Icon = isDanger ? AlertTriangle : CheckCircle2;

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel={title}>
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
              isDanger ? 'bg-red-50 ring-1 ring-red-100' : 'bg-blue-50 ring-1 ring-blue-100'
            }`}
          >
            <Icon className={`w-5 h-5 ${isDanger ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-semibold text-slate-900 leading-snug">{title}</h3>
            {description && (
              <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`text-white rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50 inline-flex items-center gap-2 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20'
            }`}
          >
            {pending && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
