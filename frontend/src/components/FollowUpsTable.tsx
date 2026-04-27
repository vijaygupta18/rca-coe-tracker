import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { RCA } from '../api/types';
import { parseRCABody } from '../utils/parseRCABody';
import StatusBadge from './StatusBadge';

interface FollowUpsTableProps {
  rcas: RCA[];
}

interface Row {
  rcaId: number;
  rcaTitle: string;
  rcaStatus: RCA['status'];
  category: string;
  action: string;
  status: string;
  owner: string;
}

const TICKET_LINK_RE = /\[([A-Z][A-Z0-9_-]*-\d+)\]\((https?:\/\/[^)]+)\)/;

function categoryToType(category: string): { label: string; cls: string } {
  const c = category.toLowerCase();
  if (c.includes('immediate')) return { label: 'Mitigate', cls: 'bg-orange-50 text-orange-700 ring-orange-100' };
  if (c.includes('monitor') || c.includes('alert')) return { label: 'Detect', cls: 'bg-blue-50 text-blue-700 ring-blue-100' };
  if (c.includes('operational')) return { label: 'Process', cls: 'bg-slate-100 text-slate-700 ring-slate-200/70' };
  if (c.includes('long-term') || c.includes('long term') || c.includes('fundamental') || c.includes('investment')) return { label: 'Prevent', cls: 'bg-red-50 text-red-700 ring-red-100' };
  return { label: 'Action', cls: 'bg-slate-100 text-slate-700 ring-slate-200/70' };
}

function statusMeta(raw: string): { label: string; dot: string; text: string } {
  const t = (raw || '').toLowerCase().replace(/[●○•]/g, '').trim();
  if (t.includes('progress') || t === 'wip') return { label: 'In Progress', dot: 'bg-amber-500', text: 'text-amber-700' };
  if (t.includes('test')) return { label: 'To Be Tested', dot: 'bg-blue-500', text: 'text-blue-700' };
  if (t.includes('block')) return { label: 'Blocked', dot: 'bg-red-500', text: 'text-red-700' };
  if (!t || t.includes('open') || t === '—' || t === '-') return { label: 'Open', dot: 'bg-slate-300', text: 'text-slate-600' };
  return { label: raw, dot: 'bg-slate-300', text: 'text-slate-600' };
}

function isOpenStatus(s: string): boolean {
  const t = s.toLowerCase();
  if (t.includes('done') || t.includes('complete') || t === 'closed') return false;
  return true;
}

function cleanText(s: string): string {
  return s.replace(TICKET_LINK_RE, '').replace(/_+/g, '').replace(/^\s*[—–-]\s*/, '').trim();
}

export default function FollowUpsTable({ rcas }: FollowUpsTableProps) {
  const navigate = useNavigate();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const r of rcas) {
      const parsed = parseRCABody(r.body);
      for (const g of parsed.actionItems) {
        for (const item of g.rows) {
          if (!isOpenStatus(item.status)) continue;
          out.push({
            rcaId: r.id,
            rcaTitle: r.title,
            rcaStatus: r.status,
            category: g.category,
            action: item.action,
            status: item.status,
            owner: item.owner,
          });
        }
      }
    }
    return out;
  }, [rcas]);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/60 p-14 text-center animate-fade-up">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 ring-1 ring-emerald-200/60 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">Nothing's stuck</h3>
        <p className="text-[13px] text-slate-500 mt-1.5 max-w-sm mx-auto">
          Everyone's caught up — no open action items across your RCAs.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/60 overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.06em] text-slate-500">
              Action
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.06em] text-slate-500 w-[120px]">
              Type
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.06em] text-slate-500 w-[120px]">
              Owner
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.06em] text-slate-500 w-[260px]">
              From RCA
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.06em] text-slate-500 w-[140px]">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const m = row.action.match(TICKET_LINK_RE);
            const ticket = m ? { id: m[1], url: m[2] } : null;
            const t = categoryToType(row.category);
            const s = statusMeta(row.status);
            return (
              <tr
                key={i}
                className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors"
              >
                <td className="px-4 py-3 align-top">
                  {ticket && (
                    <a
                      href={ticket.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center text-[11.5px] font-medium text-blue-700 bg-blue-50 ring-1 ring-blue-100 rounded px-1.5 py-0.5 mr-2 hover:bg-blue-100 transition-colors"
                    >
                      {ticket.id}
                      <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-70" />
                    </a>
                  )}
                  <span className="text-slate-700">{cleanText(row.action) || row.action}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${t.cls}`}>
                    {t.label}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">
                  {row.owner ? row.owner : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 align-top">
                  <button
                    type="button"
                    onClick={() => navigate(`/rcas/${row.rcaId}`)}
                    className="text-left text-[12.5px] text-blue-700 hover:text-blue-900 hover:underline truncate max-w-[240px] block"
                    title={row.rcaTitle}
                  >
                    {row.rcaTitle}
                  </button>
                  <div className="mt-1">
                    <StatusBadge status={row.rcaStatus} />
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`inline-flex items-center gap-1.5 text-[12px] ${s.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden />
                    {s.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
