import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LessonsPanelsProps {
  wentWell: string | null;
  couldBeBetter: string | null;
  gotLucky: string | null;
}

interface PanelProps {
  label: string;
  body: string;
  cls: string;
  labelCls: string;
}

function Panel({ label, body, cls, labelCls }: PanelProps) {
  return (
    <div className={`rounded-lg p-4 ring-1 ${cls}`}>
      <p className={`text-[10px] uppercase tracking-[0.08em] font-semibold mb-1.5 ${labelCls}`}>
        {label}
      </p>
      <div className="prose-rca prose-rca-compact text-[13px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </div>
  );
}

export default function LessonsPanels({ wentWell, couldBeBetter, gotLucky }: LessonsPanelsProps) {
  const panels: { label: string; body: string; cls: string; labelCls: string }[] = [];
  if (wentWell) panels.push({ label: 'Went well', body: wentWell, cls: 'bg-emerald-50/70 ring-emerald-200/70 text-emerald-900', labelCls: 'text-emerald-800' });
  if (couldBeBetter) panels.push({ label: 'Could have been better', body: couldBeBetter, cls: 'bg-red-50/70 ring-red-200/70 text-red-900', labelCls: 'text-red-800' });

  if (panels.length === 0 && !gotLucky) return null;

  return (
    <div className="space-y-3">
      {panels.length > 0 && (
        <div className={`grid gap-3 ${panels.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {panels.map((p) => (
            <Panel key={p.label} {...p} />
          ))}
        </div>
      )}
      {gotLucky && (
        <Panel
          label="Where we got lucky"
          body={gotLucky}
          cls="bg-amber-50/70 ring-amber-200/70 text-amber-900"
          labelCls="text-amber-800"
        />
      )}
    </div>
  );
}
