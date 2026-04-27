import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { RCA } from '../api/types';
import { formatDuration } from '../utils/format';
import { parseRCABody } from '../utils/parseRCABody';

interface TrendsBarProps {
  rcas: RCA[];
  onDismiss: () => void;
}

interface Stat {
  label: string;
  value: string;
  hint?: string;
}

function startOfMonth(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

function thirtyDaysAgo(): number {
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
}

function avgMTTR30d(rcas: RCA[]): { value: string; hint: string } {
  const cutoff = thirtyDaysAgo();
  const samples: number[] = [];
  for (const r of rcas) {
    if (!r.incident_started_at || !r.incident_resolved_at) continue;
    const resolved = new Date(r.incident_resolved_at).getTime();
    if (!Number.isFinite(resolved) || resolved < cutoff) continue;
    const started = new Date(r.incident_started_at).getTime();
    if (!Number.isFinite(started) || resolved < started) continue;
    samples.push(resolved - started);
  }
  if (samples.length === 0) return { value: '—', hint: 'no data' };
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const fakeStart = new Date(Date.now() - avg).toISOString();
  const fakeEnd = new Date().toISOString();
  return {
    value: formatDuration(fakeStart, fakeEnd),
    hint: `${samples.length} resolved`,
  };
}

function topService(rcas: RCA[]): { value: string; hint: string } {
  const since = startOfMonth();
  const counts = new Map<string, number>();
  for (const r of rcas) {
    if (new Date(r.created_at).getTime() < since) continue;
    for (const s of r.services_affected) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return { value: '—', hint: 'this month' };
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return { value: sorted[0][0], hint: `${sorted[0][1]} this month` };
}

function actionItemPctClosed(rcas: RCA[]): { value: string; hint: string } {
  let total = 0;
  let done = 0;
  for (const r of rcas) {
    const parsed = parseRCABody(r.body);
    for (const g of parsed.actionItems) {
      for (const row of g.rows) {
        total++;
        const s = row.status.toLowerCase();
        if (s.includes('done') || s.includes('complete') || s === 'closed') done++;
      }
    }
  }
  if (total === 0) return { value: '—', hint: 'no items' };
  const pct = Math.round((done / total) * 100);
  return { value: `${pct}%`, hint: `${done}/${total} closed` };
}

export default function TrendsBar({ rcas, onDismiss }: TrendsBarProps) {
  const stats = useMemo<Stat[]>(() => {
    const since = startOfMonth();
    const thisMonth = rcas.filter((r) => new Date(r.created_at).getTime() >= since).length;
    const mttr = avgMTTR30d(rcas);
    const top = topService(rcas);
    const ai = actionItemPctClosed(rcas);
    return [
      { label: 'Incidents this month', value: String(thisMonth) },
      { label: 'Avg MTTR · 30d', value: mttr.value, hint: mttr.hint },
      { label: 'Top service', value: top.value, hint: top.hint },
      { label: 'Action items closed', value: ai.value, hint: ai.hint },
    ];
  }, [rcas]);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/60 p-4 mb-4 relative">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide trends"
        className="absolute top-3 right-3 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10.5px] uppercase tracking-[0.06em] text-slate-500 font-semibold">
              {s.label}
            </p>
            <p className="text-[20px] font-semibold text-slate-900 mt-0.5 tabular-nums leading-tight truncate" title={s.value}>
              {s.value}
            </p>
            {s.hint && <p className="text-[11px] text-slate-400 mt-0.5">{s.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
