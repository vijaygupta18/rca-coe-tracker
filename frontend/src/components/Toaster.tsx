import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOpts {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends Required<Pick<ToastOpts, 'variant'>> {
  id: number;
  title?: string;
  description?: string;
  duration: number;
  action?: ToastOpts['action'];
  closing?: boolean;
}

const MAX = 5;
let nextId = 1;

// Tiny external store — no deps; React 18+ useSyncExternalStore picks it up.
const store = (() => {
  let items: ToastItem[] = [];
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(): ToastItem[] {
      return items;
    },
    push(opts: ToastOpts) {
      const item: ToastItem = {
        id: nextId++,
        title: opts.title,
        description: opts.description,
        variant: opts.variant ?? 'info',
        duration: opts.duration ?? 4000,
        action: opts.action,
      };
      items = [...items, item].slice(-MAX);
      emit();
      return item.id;
    },
    markClosing(id: number) {
      items = items.map((t) => (t.id === id ? { ...t, closing: true } : t));
      emit();
    },
    remove(id: number) {
      items = items.filter((t) => t.id !== id);
      emit();
    },
  };
})();

export function useToast() {
  const toast = (opts: ToastOpts) => store.push(opts);
  return {
    toast,
    success: (title: string, description?: string, extra: Partial<ToastOpts> = {}) =>
      toast({ ...extra, title, description, variant: 'success' }),
    error: (title: string, description?: string, extra: Partial<ToastOpts> = {}) =>
      toast({ ...extra, title, description, variant: 'error' }),
    info: (title: string, description?: string, extra: Partial<ToastOpts> = {}) =>
      toast({ ...extra, title, description, variant: 'info' }),
    warning: (title: string, description?: string, extra: Partial<ToastOpts> = {}) =>
      toast({ ...extra, title, description, variant: 'warning' }),
    dismiss: (id: number) => {
      store.markClosing(id);
      window.setTimeout(() => store.remove(id), 180);
    },
  };
}

const VARIANT_CLASSES: Record<
  ToastVariant,
  { ring: string; icon: string; iconBg: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    ring: 'ring-emerald-200/70',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    Icon: CheckCircle2,
  },
  error: {
    ring: 'ring-red-200/70',
    icon: 'text-red-600',
    iconBg: 'bg-red-50',
    Icon: AlertCircle,
  },
  info: {
    ring: 'ring-blue-200/70',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-50',
    Icon: Info,
  },
  warning: {
    ring: 'ring-amber-200/70',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-50',
    Icon: AlertTriangle,
  },
};

function ToastCard({ item }: { item: ToastItem }) {
  const cfg = VARIANT_CLASSES[item.variant];
  const { Icon } = cfg;
  const timerRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (item.closing) return;
    if (paused) return;
    timerRef.current = window.setTimeout(() => {
      store.markClosing(item.id);
      window.setTimeout(() => store.remove(item.id), 180);
    }, item.duration);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [item.id, item.duration, item.closing, paused]);

  const dismiss = () => {
    store.markClosing(item.id);
    window.setTimeout(() => store.remove(item.id), 180);
  };

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] glass rounded-xl ring-1 ${cfg.ring} shadow-[0_8px_30px_-6px_rgba(15,23,42,0.25)] px-3.5 py-3 flex gap-3 ${
        item.closing ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.iconBg}`}>
        <Icon className={`w-4 h-4 ${cfg.icon}`} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {item.title && (
          <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
        )}
        {item.description && (
          <p className={`text-[13px] text-slate-600 leading-relaxed ${item.title ? 'mt-0.5' : ''}`}>
            {item.description}
          </p>
        )}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action!.onClick();
              dismiss();
            }}
            className="mt-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100/70 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Toaster() {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>,
    document.body,
  );
}

// Helpers — extract a useful message out of an axios-like error.
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!err) return fallback;
  // axios shape
  const anyErr = err as { response?: { data?: unknown }; message?: string };
  const data = anyErr?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail) && detail.length) {
        const first = detail[0] as { msg?: string };
        if (first?.msg) return first.msg;
      }
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  if (typeof anyErr?.message === 'string') return anyErr.message;
  return fallback;
}
