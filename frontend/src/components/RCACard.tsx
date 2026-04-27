import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle } from 'lucide-react';
import type { RCA } from '../api/types';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';
import { AvatarStack } from './Avatar';
import { formatDuration, isStaleRCA, timeAgo } from '../utils/format';

function creatorDisplay(rca: RCA): string {
  if (!rca.creator_name || rca.creator_name === rca.creator_email) {
    return rca.creator_email.split('@')[0] || rca.creator_email;
  }
  return rca.creator_name;
}

interface RCACardProps {
  rca: RCA;
}

export default function RCACard({ rca }: RCACardProps) {
  const navigate = useNavigate();
  const assigneeNames = rca.assignees.map((a) => a.name);

  const duration =
    rca.incident_started_at && rca.incident_resolved_at
      ? formatDuration(rca.incident_started_at, rca.incident_resolved_at)
      : null;

  const stale = isStaleRCA(rca);
  const showMeta = rca.severity || duration || stale.stale;

  return (
    <button
      onClick={() => navigate(`/rcas/${rca.id}`)}
      className="card-sweep text-left bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-[0_8px_28px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:border-slate-300/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3
          className="text-[15px] font-semibold text-slate-900 line-clamp-2 leading-snug flex-1"
          title={rca.title}
        >
          {rca.title}
        </h3>
        <div className="shrink-0 card-bob-target">
          <StatusBadge status={rca.status} />
        </div>
      </div>

      {showMeta && (
        <div className="flex items-center flex-wrap gap-1.5 mb-2">
          {rca.severity && <SeverityBadge severity={rca.severity} />}
          {duration && (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[11px] font-medium">
              <Clock className="w-3 h-3" />
              {duration}
            </span>
          )}
          {stale.stale && (
            <span
              className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded px-1.5 py-0.5 text-[11px] font-medium"
              title={`This RCA has been ${rca.status === 'open' ? 'open' : 'in progress'} for ${stale.days} days.`}
            >
              <AlertCircle className="w-3 h-3" />
              Stale · {stale.days}d
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2 min-w-0">
          {assigneeNames.length > 0 ? (
            <>
              <AvatarStack names={assigneeNames} max={3} size="sm" />
              <span className="text-[13px] text-slate-500 truncate">
                {assigneeNames.length} {assigneeNames.length === 1 ? 'assignee' : 'assignees'}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-slate-400 italic">Unassigned</span>
          )}
        </div>
        <div className="text-[13px] text-slate-500 text-right shrink-0">
          <div className="truncate max-w-[140px]" title={rca.creator_email}>
            by {creatorDisplay(rca)}
          </div>
          <div className="text-[12px] text-slate-400">{timeAgo(rca.created_at)}</div>
        </div>
      </div>
    </button>
  );
}
