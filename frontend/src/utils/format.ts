import type { RCAStatus } from '../api/types';

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const statusColors: Record<RCAStatus, { bg: string; text: string; dot: string; ring: string }> = {
  open: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-200' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  rca_done: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', ring: 'ring-violet-200' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', ring: 'ring-slate-200' },
};

export const statusLabels: Record<RCAStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  rca_done: 'RCA Done',
  closed: 'Closed',
};

export function formatDuration(start: string, end: string): string {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  let ms = b - a;
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const minutesPart = totalMinutes % 60;
  if (totalHours < 24) {
    return minutesPart === 0 ? `${totalHours}h` : `${totalHours}h ${minutesPart}m`;
  }
  const days = Math.floor(totalHours / 24);
  const hoursPart = totalHours % 24;
  return hoursPart === 0 ? `${days}d` : `${days}d ${hoursPart}h`;
}

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const STALE_DAYS = 7;

export function isStaleRCA(rca: { status: RCAStatus; created_at: string }): {
  stale: boolean;
  days: number;
} {
  if (rca.status === 'closed' || rca.status === 'rca_done') return { stale: false, days: 0 };
  const created = new Date(rca.created_at).getTime();
  if (!Number.isFinite(created)) return { stale: false, days: 0 };
  const days = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
  return { stale: days >= STALE_DAYS, days };
}
