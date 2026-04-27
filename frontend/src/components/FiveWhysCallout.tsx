import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FiveWhysCalloutProps {
  markdown: string;
}

// Returns a list of trimmed item strings if the markdown is a clean
// `1. ... 2. ...` numbered list; otherwise null and we fall back to <ReactMarkdown/>.
function parseNumbered(md: string): string[] | null {
  const lines = md.split('\n');
  const items: string[] = [];
  let buffer = '';
  for (const ln of lines) {
    const m = ln.match(/^\s*\d+\.\s+(.*)$/);
    if (m) {
      if (buffer) items.push(buffer.trim());
      buffer = m[1];
    } else if (buffer && ln.trim()) {
      buffer += ' ' + ln.trim();
    }
  }
  if (buffer) items.push(buffer.trim());
  if (items.length < 2) return null;
  return items;
}

export default function FiveWhysCallout({ markdown }: FiveWhysCalloutProps) {
  const items = parseNumbered(markdown);
  return (
    <div className="bg-slate-50 rounded-lg p-4 ring-1 ring-slate-200/60">
      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-2">
        5 Whys
      </p>
      {items ? (
        <ol className="list-decimal pl-5 space-y-1.5 text-[13px] leading-relaxed text-slate-700 marker:text-slate-400 marker:tabular-nums">
          {items.map((it, i) => (
            <li key={i}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <span>{children}</span>,
                }}
              >
                {it}
              </ReactMarkdown>
            </li>
          ))}
        </ol>
      ) : (
        <div className="prose-rca prose-rca-compact text-[13px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
