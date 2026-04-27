import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteRCA,
  fetchRCA,
  fetchRCAHistory,
  regenerateSummary,
  updateRCA,
} from '../api/client';
import type { RCA, RCAHistoryEntry, RCASeverity, RCAStatus, User } from '../api/types';
import type { UpdateRCAPatch } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import StatusStepper from '../components/StatusStepper';
import SeverityIcon from '../components/SeverityIcon';
import SeverityPicker from '../components/SeverityPicker';
import TagInput from '../components/TagInput';
import Avatar, { AvatarStack } from '../components/Avatar';
import UserAutocomplete from '../components/UserAutocomplete';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown, { DropdownItem } from '../components/Dropdown';
import { useToast, getErrorMessage } from '../components/Toaster';
import {
  formatDate,
  formatDuration,
  fromDatetimeLocal,
  statusLabels,
  timeAgo,
  toDatetimeLocal,
} from '../utils/format';

const TS_FIELDS = [
  { key: 'incident_started_at', label: 'Started' },
  { key: 'incident_detected_at', label: 'Detected' },
  { key: 'incident_mitigated_at', label: 'Mitigated' },
  { key: 'incident_resolved_at', label: 'Resolved' },
] as const;

// Display fallback for users we don't have a DB row for.
function displayCreator(rca: RCA): { primary: string; secondary?: string } {
  const local = rca.creator_email.split('@')[0] || rca.creator_email;
  if (!rca.creator_name || rca.creator_name === rca.creator_email) {
    return { primary: local, secondary: 'email' };
  }
  return { primary: rca.creator_name };
}

interface InteractiveMarkdownProps {
  body: string;
  onChangeChecklist?: (nextBody: string) => void;
  canEdit?: boolean;
}

// Parse the markdown body, render checkboxes as real <input type="checkbox"> that toggle [ ]/[x].
function InteractiveMarkdown({ body, onChangeChecklist, canEdit }: InteractiveMarkdownProps) {
  // Build a flat list of checklist line indices so each <li> can claim its own.
  const checklistLines = useMemo(() => {
    const lines = body.split('\n');
    const refs: { lineIdx: number; checked: boolean; text: string }[] = [];
    lines.forEach((ln, i) => {
      const m = ln.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/);
      if (m) {
        refs.push({ lineIdx: i, checked: /[xX]/.test(m[3]), text: m[4] });
      }
    });
    return refs;
  }, [body]);

  // We assign a sequential checklist index to each rendered checkbox in DOM order.
  const counter = useRef(0);
  // Reset counter every render (a render = one parse).
  counter.current = 0;

  const toggleAt = (idx: number) => {
    if (!canEdit || !onChangeChecklist) return;
    const ref = checklistLines[idx];
    if (!ref) return;
    const lines = body.split('\n');
    const ln = lines[ref.lineIdx];
    const next = ref.checked
      ? ln.replace(/^(\s*[-*+]\s+\[)[xX](\]\s+.*)$/, '$1 $2')
      : ln.replace(/^(\s*[-*+]\s+\[) (\]\s+.*)$/, '$1x$2');
    lines[ref.lineIdx] = next;
    onChangeChecklist(lines.join('\n'));
  };

  return (
    <div className="prose-rca">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          li: (props: ComponentPropsWithoutRef<'li'> & { checked?: boolean | null }) => {
            const { checked, children, className, ...rest } = props;
            // remark-gfm flags task list items via `checked` prop on <li>.
            if (typeof checked === 'boolean') {
              const myIdx = counter.current++;
              return (
                <li
                  {...rest}
                  className={`${className ?? ''} flex items-start gap-2 list-none -ml-5`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canEdit}
                    onChange={() => toggleAt(myIdx)}
                    className={`mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${
                      !canEdit ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                    }`}
                  />
                  <span
                    className={`flex-1 ${
                      checked ? 'line-through text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {children}
                  </span>
                </li>
              );
            }
            return (
              <li {...rest} className={className}>
                {children}
              </li>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

interface SidebarCardProps {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function SidebarCard({ label, children, action }: SidebarCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
          {label}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function TimingChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-slate-100 rounded-md px-2 py-0.5 text-[11px] text-slate-600">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="tabular-nums text-slate-500">{value}</span>
    </span>
  );
}

interface RCADetailContentProps {
  rca: RCA;
}

function RCADetailContent({ rca }: RCADetailContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, canEdit, canDelete } = useAuth();
  const { success, error, info } = useToast();

  const editable = canEdit(rca);
  const deletable = canDelete(rca);

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(rca.title);

  const [bodyEditing, setBodyEditing] = useState(false);
  const [bodyDraft, setBodyDraft] = useState(rca.body);

  const [assigneesEditing, setAssigneesEditing] = useState(false);
  const [assigneesDraft, setAssigneesDraft] = useState<User[]>(rca.assignees);

  const [showDelete, setShowDelete] = useState(false);

  const [servicesDraft, setServicesDraft] = useState<string[]>(rca.services_affected);
  const [tsDraft, setTsDraft] = useState({
    incident_started_at: toDatetimeLocal(rca.incident_started_at),
    incident_detected_at: toDatetimeLocal(rca.incident_detected_at),
    incident_mitigated_at: toDatetimeLocal(rca.incident_mitigated_at),
    incident_resolved_at: toDatetimeLocal(rca.incident_resolved_at),
  });

  useEffect(() => {
    setTitleDraft(rca.title);
    setBodyDraft(rca.body);
    setAssigneesDraft(rca.assignees);
    setServicesDraft(rca.services_affected);
    setTsDraft({
      incident_started_at: toDatetimeLocal(rca.incident_started_at),
      incident_detected_at: toDatetimeLocal(rca.incident_detected_at),
      incident_mitigated_at: toDatetimeLocal(rca.incident_mitigated_at),
      incident_resolved_at: toDatetimeLocal(rca.incident_resolved_at),
    });
  }, [rca]);

  const prevSummaryAt = useRef<string | null>(rca.ai_summary_at);
  useEffect(() => {
    prevSummaryAt.current = rca.ai_summary_at;
  }, [rca.ai_summary_at]);

  const patch = useMutation({
    mutationFn: (p: UpdateRCAPatch) => updateRCA(rca.id, p),
    onSuccess: (next, variables) => {
      queryClient.setQueryData(['rca', rca.id], next);
      queryClient.invalidateQueries({ queryKey: ['rcas'] });
      queryClient.invalidateQueries({ queryKey: ['rca-history', rca.id] });
      if ('status' in variables) {
        success('Status updated', `Now ${statusLabels[next.status]}`);
      }
    },
    onError: (err) => {
      error('Update failed', getErrorMessage(err));
    },
  });

  const del = useMutation({
    mutationFn: () => deleteRCA(rca.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rcas'] });
      success('RCA deleted');
      navigate('/');
    },
    onError: (err) => {
      error('Could not delete RCA', getErrorMessage(err));
    },
  });

  const regen = useMutation({
    mutationFn: () => regenerateSummary(rca.id),
    onMutate: () => {
      info('Regenerating summary…', 'This usually takes a few seconds.');
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['rca', rca.id], next);
      if (next.ai_summary_at && next.ai_summary_at !== prevSummaryAt.current) {
        success('Summary updated');
        prevSummaryAt.current = next.ai_summary_at;
      }
    },
    onError: (err) => {
      error('Regenerate failed', getErrorMessage(err));
    },
  });

  const saveTitle = () => {
    const v = titleDraft.trim();
    if (!v || v === rca.title) {
      setTitleEditing(false);
      setTitleDraft(rca.title);
      return;
    }
    patch.mutate({ title: v });
    setTitleEditing(false);
  };

  const saveBody = () => {
    if (bodyDraft === rca.body) {
      setBodyEditing(false);
      return;
    }
    patch.mutate({ body: bodyDraft });
    setBodyEditing(false);
  };

  const saveAssignees = () => {
    const next = assigneesDraft.map((u) => u.email).sort();
    const prev = rca.assignees.map((u) => u.email).sort();
    if (JSON.stringify(next) === JSON.stringify(prev)) {
      setAssigneesEditing(false);
      return;
    }
    patch.mutate({ assignee_emails: next });
    setAssigneesEditing(false);
  };

  const changeStatus = (next: RCAStatus) => {
    if (!editable) return;
    if (next === rca.status) return;
    patch.mutate({ status: next });
  };

  const changeSeverity = (next: RCASeverity | null) => {
    if (next === rca.severity) return;
    patch.mutate({ severity: next });
  };

  // Toggling a checkbox from the rendered markdown PATCHes the body.
  const onChecklistToggle = (nextBody: string) => {
    if (!editable) return;
    queryClient.setQueryData(['rca', rca.id], { ...rca, body: nextBody });
    patch.mutate({ body: nextBody });
  };

  // Debounced patch helpers for free-text / array / timestamp edits.
  const servicesTimer = useRef<number | null>(null);
  const onServicesChange = (next: string[]) => {
    setServicesDraft(next);
    if (servicesTimer.current) window.clearTimeout(servicesTimer.current);
    servicesTimer.current = window.setTimeout(() => {
      if (JSON.stringify(next) === JSON.stringify(rca.services_affected)) return;
      patch.mutate({ services_affected: next });
    }, 600);
  };

  const tsTimers = useRef<Record<string, number | null>>({});
  const onTsChange = (key: (typeof TS_FIELDS)[number]['key'], v: string) => {
    setTsDraft((d) => ({ ...d, [key]: v }));
    if (tsTimers.current[key]) window.clearTimeout(tsTimers.current[key]!);
    tsTimers.current[key] = window.setTimeout(() => {
      const iso = fromDatetimeLocal(v);
      if (iso === rca[key]) return;
      patch.mutate({ [key]: iso } as UpdateRCAPatch);
    }, 600);
  };

  const { data: history } = useQuery({
    queryKey: ['rca-history', rca.id],
    queryFn: () => fetchRCAHistory(rca.id),
  });

  const ttd =
    rca.incident_started_at && rca.incident_detected_at
      ? formatDuration(rca.incident_started_at, rca.incident_detected_at)
      : null;
  const ttRespond =
    rca.incident_detected_at && rca.incident_mitigated_at
      ? formatDuration(rca.incident_detected_at, rca.incident_mitigated_at)
      : null;
  const ttResolve =
    rca.incident_started_at && rca.incident_resolved_at
      ? formatDuration(rca.incident_started_at, rca.incident_resolved_at)
      : null;

  const showDurations = ttd || ttRespond || ttResolve;
  const showSummaryCard = rca.status === 'rca_done' || rca.status === 'closed';
  const summaryGenerating =
    showSummaryCard && rca.ai_summary == null && (rca.status === 'closed' || rca.status === 'rca_done');

  const creator = displayCreator(rca);

  return (
    <div className="px-5 md:px-8 py-6 max-w-[1280px] mx-auto">
      {/* Top action row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => {
            // If we have history depth, go back; else fall back to the list.
            if (window.history.length > 1) navigate(-1);
            else navigate('/');
          }}
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900 transition-colors active:scale-[0.97]"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {(deletable || isAdmin) && (
            <Dropdown
              align="right"
              width={220}
              trigger={
                <button
                  type="button"
                  aria-label="More actions"
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              }
            >
              {(close) => (
                <>
                  {isAdmin && showSummaryCard && rca.ai_summary && (
                    <DropdownItem
                      leading={<RefreshCw className="w-4 h-4 text-violet-500" />}
                      onSelect={() => {
                        regen.mutate();
                        close();
                      }}
                    >
                      Regenerate AI summary
                    </DropdownItem>
                  )}
                  {deletable && (
                    <>
                      {isAdmin && showSummaryCard && rca.ai_summary && (
                        <div className="h-px bg-slate-200/70 mx-1 my-1" aria-hidden />
                      )}
                      <DropdownItem
                        danger
                        leading={<Trash2 className="w-4 h-4" />}
                        onSelect={() => {
                          close();
                          setShowDelete(true);
                        }}
                      >
                        Delete RCA
                      </DropdownItem>
                    </>
                  )}
                </>
              )}
            </Dropdown>
          )}
        </div>
      </div>

      {/* Title + meta */}
      <div className="mb-5">
        {titleEditing ? (
          <input
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveTitle();
              } else if (e.key === 'Escape') {
                setTitleDraft(rca.title);
                setTitleEditing(false);
              }
            }}
            className="w-full text-[26px] leading-tight font-bold text-slate-900 tracking-tight bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 soft-focus focus:outline-none focus:border-blue-400"
          />
        ) : (
          <div className="group flex items-start gap-2 min-w-0">
            <h1
              onClick={() => editable && setTitleEditing(true)}
              className={`text-[26px] leading-tight font-bold text-slate-900 tracking-tight flex-1 min-w-0 ${
                editable ? 'cursor-text hover:text-slate-700 transition-colors' : ''
              }`}
              title={editable ? 'Click to edit' : rca.title}
            >
              {rca.title}
            </h1>
            {editable && (
              <button
                type="button"
                onClick={() => setTitleEditing(true)}
                className="shrink-0 opacity-0 group-hover:opacity-100 mt-2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                aria-label="Edit title"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-500">
          <Avatar name={creator.primary} size="xs" />
          <span>
            by <span className="text-slate-700 font-medium">{creator.primary}</span>
            {creator.secondary && (
              <span className="text-slate-400"> ({creator.secondary})</span>
            )}
          </span>
          <span className="text-slate-300">·</span>
          <span title={formatDate(rca.created_at)}>{timeAgo(rca.created_at)}</span>
          {rca.closed_at && (
            <>
              <span className="text-slate-300">·</span>
              <span title={formatDate(rca.closed_at)}>closed {timeAgo(rca.closed_at)}</span>
            </>
          )}
        </div>
      </div>

      {/* Status stepper */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-3 mb-5">
        <StatusStepper
          value={rca.status}
          onChange={changeStatus}
          canEdit={editable}
          pending={patch.isPending}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
        {/* LEFT — Body + AI summary + History */}
        <div className="min-w-0 space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200/60 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
                Description
              </h3>
              {editable && !bodyEditing && (
                <button
                  onClick={() => {
                    setBodyDraft(rca.body);
                    setBodyEditing(true);
                  }}
                  className="text-[12px] text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>
            {bodyEditing ? (
              <div>
                <textarea
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  rows={16}
                  placeholder="Markdown supported"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm soft-focus focus:outline-none focus:border-blue-400 font-mono leading-relaxed"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setBodyDraft(rca.body);
                      setBodyEditing(false);
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveBody}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : rca.body.trim() ? (
              <div className="max-w-[68ch]">
                <InteractiveMarkdown
                  body={rca.body}
                  onChangeChecklist={onChecklistToggle}
                  canEdit={editable}
                />
              </div>
            ) : (
              <p className="text-[13px] text-slate-400 italic">No description yet.</p>
            )}
          </section>

          {showSummaryCard && (
            <section className="relative rounded-2xl p-[1px] bg-gradient-to-br from-violet-300 via-blue-300 to-violet-300 animate-rca-reveal">
              <div className="bg-white rounded-[15px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                        AI Summary
                      </h3>
                      {rca.ai_summary_at && (
                        <p className="text-[11px] text-slate-500 leading-tight">
                          {rca.ai_summary_model ? `${rca.ai_summary_model} · ` : ''}
                          {timeAgo(rca.ai_summary_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  {isAdmin && rca.ai_summary && (
                    <button
                      onClick={() => regen.mutate()}
                      disabled={regen.isPending}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-all duration-150 disabled:opacity-50 active:scale-[0.97]"
                    >
                      <RefreshCw className={`w-3 h-3 ${regen.isPending ? 'animate-spin' : ''}`} />
                      {regen.isPending ? 'Regenerating' : 'Regenerate'}
                    </button>
                  )}
                </div>

                {rca.ai_summary ? (
                  <div className="prose-rca prose-rca-compact max-w-[68ch]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{rca.ai_summary}</ReactMarkdown>
                  </div>
                ) : summaryGenerating ? (
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-5/6" />
                    <div className="skeleton h-3 w-4/6" />
                    <div className="skeleton h-3 w-3/6" />
                    <p className="text-[11.5px] text-slate-400 mt-2 inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
                      Generating summary…
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">
                    A summary will be generated automatically when this RCA reaches "RCA Done" or
                    "Closed".
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="bg-white rounded-2xl border border-slate-200/60 p-6">
            <h3 className="text-[10px] uppercase tracking-[0.08em] text-slate-400 font-semibold mb-4">
              History
            </h3>
            {!history || history.length === 0 ? (
              <p className="text-[13px] text-slate-400 italic">No activity yet.</p>
            ) : (
              <ol className="relative space-y-3 pl-5">
                <span
                  className="absolute left-2 top-1.5 bottom-1.5 w-px bg-slate-200"
                  aria-hidden
                />
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span
                      className="absolute -left-[14px] top-2 w-2 h-2 rounded-full bg-slate-300 ring-2 ring-white"
                      aria-hidden
                    />
                    <div className="flex items-start gap-2">
                      <Avatar name={h.actor_email} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-700">
                          <span className="font-medium text-slate-900">
                            {h.actor_email.split('@')[0]}
                          </span>{' '}
                          <span className="text-slate-500">{describeAction(h)}</span>
                        </p>
                        <p
                          className="text-[11.5px] text-slate-400 tabular-nums"
                          title={formatDate(h.at)}
                        >
                          {timeAgo(h.at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* RIGHT — Bento sidebar */}
        <aside className="space-y-3">
          <SidebarCard label="Severity">
            {editable ? (
              <SeverityPicker value={rca.severity} onChange={changeSeverity} />
            ) : (
              <SeverityIcon severity={rca.severity} size={18} withLabel />
            )}
          </SidebarCard>

          <SidebarCard label="Services">
            {editable ? (
              <TagInput
                value={servicesDraft}
                onChange={onServicesChange}
                placeholder="Add and Enter…"
              />
            ) : rca.services_affected.length === 0 ? (
              <span className="text-[12px] text-slate-400 italic">—</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {rca.services_affected.map((s) => (
                  <span
                    key={s}
                    className="bg-slate-100 text-slate-700 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </SidebarCard>

          <SidebarCard label="When did it happen">
            <div className="space-y-2.5">
              {TS_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-[10.5px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                    {f.label}
                  </label>
                  {editable ? (
                    <input
                      type="datetime-local"
                      value={tsDraft[f.key] || ''}
                      onChange={(e) => onTsChange(f.key, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12.5px] tabular-nums soft-focus focus:outline-none focus:border-blue-400"
                    />
                  ) : (
                    <span className="text-[12.5px] text-slate-700 tabular-nums">
                      {rca[f.key] ? (
                        <span title={formatDate(rca[f.key]!)}>{formatDate(rca[f.key]!)}</span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {showDurations && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {ttd && <TimingChip label="TTD" value={ttd} />}
                {ttRespond && <TimingChip label="Respond" value={ttRespond} />}
                {ttResolve && <TimingChip label="Resolve" value={ttResolve} />}
              </div>
            )}
          </SidebarCard>

          <SidebarCard
            label="Assignees"
            action={
              editable && !assigneesEditing ? (
                <button
                  onClick={() => {
                    setAssigneesDraft(rca.assignees);
                    setAssigneesEditing(true);
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              ) : null
            }
          >
            {assigneesEditing ? (
              <div>
                <UserAutocomplete value={assigneesDraft} onChange={setAssigneesDraft} />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setAssigneesDraft(rca.assignees);
                      setAssigneesEditing(false);
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors active:scale-[0.97]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAssignees}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors active:scale-[0.97]"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : rca.assignees.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">Unassigned</p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <AvatarStack names={rca.assignees.map((a) => a.name)} max={5} size="sm" />
                <div className="text-[12px] text-slate-600 truncate min-w-0">
                  {rca.assignees.map((a) => a.name).join(' · ')}
                </div>
              </div>
            )}
          </SidebarCard>
        </aside>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => del.mutate()}
        pending={del.isPending}
        variant="danger"
        title="Delete this RCA?"
        description="This will permanently remove the RCA and its history. This can't be undone."
        confirmLabel="Delete RCA"
      />
    </div>
  );
}

const FIELD_HUMAN: Record<string, string> = {
  title: 'title',
  body: 'description',
  severity: 'severity',
  environment: 'environment',
  services_affected: 'services affected',
  incident_started_at: 'incident start time',
  incident_detected_at: 'incident detection time',
  incident_mitigated_at: 'incident mitigation time',
  incident_resolved_at: 'incident resolution time',
};

function humanizeStatus(value: string): string {
  const key = value as RCAStatus;
  return statusLabels[key] ?? value;
}

function describeAction(h: RCAHistoryEntry): string {
  switch (h.action) {
    case 'created':
      return 'created this RCA';
    case 'status_changed': {
      const to = h.to_value ? humanizeStatus(h.to_value) : '';
      return `changed status to ${to}`.trim();
    }
    case 'assigned':
      return `assigned ${h.to_value?.split('@')[0] ?? ''}`.trim();
    case 'unassigned':
      return `unassigned ${(h.to_value ?? h.from_value ?? '').split('@')[0] ?? ''}`.trim();
    case 'edited': {
      const field = h.from_value ? FIELD_HUMAN[h.from_value] ?? h.from_value : 'the RCA';
      if (h.from_value === 'severity' && h.to_value) {
        return `changed severity to ${h.to_value.toUpperCase()}`;
      }
      if (h.from_value === 'environment' && h.to_value) {
        return `set environment to ${h.to_value}`;
      }
      if (h.from_value === 'services_affected' && h.to_value) {
        return `updated services to ${h.to_value}`;
      }
      if (h.from_value === 'title' && h.to_value) {
        return `renamed to "${h.to_value}"`;
      }
      return `updated ${field}`;
    }
    case 'deleted':
      return 'deleted the RCA';
    default:
      return h.action;
  }
}

export default function RCADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const numericId = id ? Number(id) : NaN;

  const { data, isLoading, error, refetch } = useQuery<RCA>({
    queryKey: ['rca', numericId],
    queryFn: () => fetchRCA(numericId),
    enabled: Number.isFinite(numericId),
    refetchInterval: (query) => {
      const r = query.state.data;
      if ((r?.status === 'closed' || r?.status === 'rca_done') && r.ai_summary == null) return 4000;
      return false;
    },
  });

  if (!Number.isFinite(numericId)) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">RCA not found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-5 md:px-8 py-6 max-w-[1280px] mx-auto">
        <div className="skeleton h-3 w-20 mb-4" />
        <div className="skeleton h-7 w-2/3 mb-3" />
        <div className="skeleton h-3 w-40 mb-5" />
        <div className="skeleton h-12 rounded-2xl mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
          <div className="space-y-3">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-4/5" />
          </div>
          <div className="space-y-3">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-16 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center animate-fade-up">
          <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium mb-1">Failed to load this RCA</p>
          <p className="text-[13px] text-slate-400 mb-4">
            It may have been deleted or you don't have access.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Back to list
            </button>
            <button
              onClick={() => refetch()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <RCADetailContent rca={data} />;
}
