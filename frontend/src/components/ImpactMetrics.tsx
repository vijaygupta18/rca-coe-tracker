import type { RCA } from '../api/types';
import { formatDuration } from '../utils/format';
import { extractFirstQuantity } from '../utils/parseRCABody';

interface ImpactMetricsProps {
  rca: RCA;
  consequence?: string | null;
}

interface Metric {
  label: string;
  value: string;
  tone?: 'normal' | 'warn';
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function statusDuration(rca: RCA): string {
  const since = rca.updated_at || rca.created_at;
  const ms = Date.now() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
}

export default function ImpactMetrics({ rca, consequence }: ImpactMetricsProps) {
  const metrics: Metric[] = [];

  // MTTD — start → detect.
  if (rca.incident_started_at && rca.incident_detected_at) {
    metrics.push({
      label: 'MTTD',
      value: formatDuration(rca.incident_started_at, rca.incident_detected_at),
    });
  } else {
    metrics.push({ label: 'MTTD', value: '—' });
  }

  // MTTR — start → resolve.
  if (rca.incident_started_at && rca.incident_resolved_at) {
    metrics.push({
      label: 'MTTR',
      value: formatDuration(rca.incident_started_at, rca.incident_resolved_at),
    });
  } else {
    metrics.push({ label: 'MTTR', value: '—' });
  }

  // Open since (or status duration once moving past Open).
  if (rca.status === 'open' || rca.status === 'in_progress') {
    const days = daysSince(rca.created_at);
    metrics.push({
      label: 'Open since',
      value: `${days}d`,
      tone: days > 7 ? 'warn' : 'normal',
    });
  } else {
    metrics.push({ label: 'In status', value: statusDuration(rca) });
  }

  // 4th card from the body's consequence-of-impact text, if a number can be extracted.
  const q = extractFirstQuantity(consequence ?? null);
  if (q) {
    metrics.push({ label: q.label.slice(0, 24), value: q.value });
  }

  return (
    <div className={`grid gap-2 ${metrics.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
      {metrics.map((m, i) => (
        <div key={i} className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-100/70">
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-slate-500 font-semibold">
            {m.label}
          </p>
          <p
            className={`text-lg font-semibold mt-0.5 tabular-nums leading-tight ${
              m.tone === 'warn' ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {m.value}
          </p>
        </div>
      ))}
    </div>
  );
}
