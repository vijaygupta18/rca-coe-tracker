import type { RCA } from '../api/types';
import { formatDuration, statusColors, statusLabels } from '../utils/format';

const SEV_PILL = {
  sev1: 'bg-red-50 text-red-700 ring-red-100',
  sev2: 'bg-orange-50 text-orange-700 ring-orange-100',
  sev3: 'bg-yellow-50 text-yellow-700 ring-yellow-100',
};

const SEV_LABEL = { sev1: 'SEV-1', sev2: 'SEV-2', sev3: 'SEV-3' } as const;

const PILL = 'inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full ring-1 font-medium';

interface PillRowProps {
  rca: RCA;
}

// Heuristic: SEV1/SEV2 incidents are user-facing unless we learn otherwise.
function isCustomerFacing(rca: RCA): boolean {
  return rca.severity === 'sev1' || rca.severity === 'sev2';
}

export default function PillRow({ rca }: PillRowProps) {
  const sevPill = rca.severity ? (
    <span className={`${PILL} ${SEV_PILL[rca.severity]}`}>{SEV_LABEL[rca.severity]}</span>
  ) : null;

  const sc = statusColors[rca.status];
  const statusPill = (
    <span className={`${PILL} ${sc.bg} ${sc.text} ${sc.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} aria-hidden />
      {statusLabels[rca.status]}
    </span>
  );

  const downtime =
    rca.incident_started_at && rca.incident_resolved_at
      ? formatDuration(rca.incident_started_at, rca.incident_resolved_at)
      : null;

  const services = rca.services_affected.slice(0, 3);
  const overflow = rca.services_affected.length - services.length;

  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {sevPill}
      {statusPill}
      {downtime && (
        <span className={`${PILL} bg-slate-100 text-slate-600 ring-slate-200/70`}>
          {downtime} downtime
        </span>
      )}
      {isCustomerFacing(rca) && (
        <span className={`${PILL} bg-slate-100 text-slate-600 ring-slate-200/70`}>
          Customer-facing
        </span>
      )}
      {rca.environment && (
        <span className={`${PILL} bg-slate-100 text-slate-600 ring-slate-200/70`}>
          {rca.environment}
        </span>
      )}
      {services.map((s) => (
        <span key={s} className={`${PILL} bg-slate-100 text-slate-600 ring-slate-200/70`}>
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span className={`${PILL} bg-slate-100 text-slate-500 ring-slate-200/70`}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
