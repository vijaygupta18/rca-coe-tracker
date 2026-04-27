import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { createRCA } from '../api/client';
import type { RCASeverity, User } from '../api/types';
import UserAutocomplete from './UserAutocomplete';
import SeverityPicker from './SeverityPicker';
import TagInput from './TagInput';
import Modal from './Modal';
import Dropdown, { DropdownItem } from './Dropdown';
import DatePicker, { type DatePickerPreset } from './DatePicker';
import { useToast, getErrorMessage } from './Toaster';
import { formatDuration } from '../utils/format';

interface CreateRCAModalProps {
  open: boolean;
  onClose: () => void;
}

const ACTION_STATUSES = ['Open', 'In Progress', 'To Be Tested', 'Closed'] as const;
type ActionStatus = (typeof ACTION_STATUSES)[number];

interface ActionItemRow {
  action: string;
  status: ActionStatus;
  owner: string;
}

interface TimelineRow {
  time: string;
  event: string;
}

const ACTION_CATEGORIES = [
  'Immediate Fixes',
  'Monitoring & Alerts',
  'Operational Excellence',
  'Fundamental Long-Term Investments',
] as const;
type ActionCategory = (typeof ACTION_CATEGORIES)[number];

const emptyActionRow = (): ActionItemRow => ({ action: '', status: 'Open', owner: '' });
const emptyTimelineRow = (): TimelineRow => ({ time: '', event: '' });

const ACTION_TIP = '_Tip: file each item as an Argus issue and paste the link in the action column._';

const DRAFT_KEY = 'rca-tracker:create-draft:v1';

interface DraftShape {
  savedAt: string;
  title: string;
  severity: RCASeverity | null;
  services: string[];
  startedAt: string;
  detectedAt: string;
  mitigatedAt: string;
  resolvedAt: string;
  assignees: User[];
  summary: string;
  impact: string;
  consequence: string;
  fiveWhys: string;
  immediateResolution: string;
  wentWell: string;
  couldBeBetter: string;
  gotLucky: string;
  actions: Record<ActionCategory, ActionItemRow[]>;
  timeline: TimelineRow[];
  overrideBody: string | null;
}

function readDraft(): DraftShape | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftShape;
  } catch {
    return null;
  }
}

function writeDraft(d: DraftShape): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // localStorage full or disabled — silently skip; the user just loses draft persistence.
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function isMeaningful(d: DraftShape): boolean {
  if (d.title.trim()) return true;
  if (d.severity) return true;
  if (d.summary.trim() || d.impact.trim() || d.consequence.trim() || d.fiveWhys.trim()) return true;
  if (d.immediateResolution.trim() || d.wentWell.trim() || d.couldBeBetter.trim() || d.gotLucky.trim()) return true;
  if (d.services.length || d.assignees.length) return true;
  if (d.timeline.some((r) => r.time.trim() || r.event.trim())) return true;
  for (const cat of ACTION_CATEGORIES) {
    if (d.actions[cat]?.some((r) => r.action.trim() || r.owner.trim())) return true;
  }
  return false;
}

function composeBody(parts: {
  summary: string;
  impact: string;
  consequence: string;
  fiveWhys: string;
  immediateResolution: string;
  wentWell: string;
  couldBeBetter: string;
  gotLucky: string;
  actions: Record<ActionCategory, ActionItemRow[]>;
  timeline: TimelineRow[];
}): string {
  const blocks: string[] = [];

  const addText = (heading: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    blocks.push(`## ${heading}\n\n${t}`);
  };

  addText('Summary', parts.summary);
  addText('What was the impact?', parts.impact);
  addText('What is the consequence of impact?', parts.consequence);
  addText('Root cause — Five Whys', parts.fiveWhys);
  addText('Immediate Resolution', parts.immediateResolution);

  const wellTrim = parts.wentWell.trim();
  const betterTrim = parts.couldBeBetter.trim();
  const luckyTrim = parts.gotLucky.trim();
  if (wellTrim || betterTrim || luckyTrim) {
    const sub: string[] = ['## Takeaways'];
    if (wellTrim) sub.push(`### What went well?\n\n${wellTrim}`);
    if (betterTrim) sub.push(`### What could have been better?\n\n${betterTrim}`);
    if (luckyTrim) sub.push(`### Where did we get lucky?\n\n${luckyTrim}`);
    blocks.push(sub.join('\n\n'));
  }

  const actionCategoryBlocks: string[] = [];
  for (const cat of ACTION_CATEGORIES) {
    const rows = parts.actions[cat].filter(
      (r) => r.action.trim() || r.owner.trim(),
    );
    if (rows.length === 0) continue;
    const lines: string[] = [];
    lines.push(`### ${cat}`);
    lines.push('');
    lines.push('| Action Item | Status | Owner |');
    lines.push('|---|---|---|');
    for (const r of rows) {
      lines.push(`| ${r.action.trim()} | ${r.status} | ${r.owner.trim()} |`);
    }
    lines.push('');
    lines.push(ACTION_TIP);
    actionCategoryBlocks.push(lines.join('\n'));
  }
  if (actionCategoryBlocks.length > 0) {
    blocks.push(['## Action Items', '', ...actionCategoryBlocks].join('\n'));
  }

  const tlRows = parts.timeline.filter((r) => r.time.trim() || r.event.trim());
  if (tlRows.length > 0) {
    const lines: string[] = [];
    lines.push('## Timeline');
    lines.push('');
    lines.push('| Time | Event |');
    lines.push('|---|---|');
    for (const r of tlRows) {
      lines.push(`| ${r.time.trim()} | ${r.event.trim()} |`);
    }
    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n\n');
}

export default function CreateRCAModal({ open, onClose }: CreateRCAModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<RCASeverity | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState('');
  const [detectedAt, setDetectedAt] = useState('');
  const [mitigatedAt, setMitigatedAt] = useState('');
  const [resolvedAt, setResolvedAt] = useState('');
  const [assignees, setAssignees] = useState<User[]>([]);
  const [touched, setTouched] = useState(false);

  const [summary, setSummary] = useState('');
  const [impact, setImpact] = useState('');
  const [consequence, setConsequence] = useState('');
  const [fiveWhys, setFiveWhys] = useState('');
  const [immediateResolution, setImmediateResolution] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [couldBeBetter, setCouldBeBetter] = useState('');
  const [gotLucky, setGotLucky] = useState('');

  const [actions, setActions] = useState<Record<ActionCategory, ActionItemRow[]>>({
    'Immediate Fixes': [emptyActionRow()],
    'Monitoring & Alerts': [emptyActionRow()],
    'Operational Excellence': [emptyActionRow()],
    'Fundamental Long-Term Investments': [emptyActionRow()],
  });
  const [timeline, setTimeline] = useState<TimelineRow[]>([emptyTimelineRow()]);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideBody, setOverrideBody] = useState<string | null>(null);

  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const skipNextSave = useRef(false);

  const reset = () => {
    setTitle('');
    setSeverity(null);
    setServices([]);
    setStartedAt('');
    setDetectedAt('');
    setMitigatedAt('');
    setResolvedAt('');
    setAssignees([]);
    setTouched(false);
    setSummary('');
    setImpact('');
    setConsequence('');
    setFiveWhys('');
    setImmediateResolution('');
    setWentWell('');
    setCouldBeBetter('');
    setGotLucky('');
    setActions({
      'Immediate Fixes': [emptyActionRow()],
      'Monitoring & Alerts': [emptyActionRow()],
      'Operational Excellence': [emptyActionRow()],
      'Fundamental Long-Term Investments': [emptyActionRow()],
    });
    setTimeline([emptyTimelineRow()]);
    setOverrideOpen(false);
    setOverrideBody(null);
    setDraftRestored(false);
    setDraftSavedAt(null);
  };

  useEffect(() => {
    if (!open) return;
    const d = readDraft();
    if (d && isMeaningful(d)) {
      skipNextSave.current = true;
      setTitle(d.title || '');
      setSeverity(d.severity ?? null);
      setServices(d.services || []);
      setStartedAt(d.startedAt || '');
      setDetectedAt(d.detectedAt || '');
      setMitigatedAt(d.mitigatedAt || '');
      setResolvedAt(d.resolvedAt || '');
      setAssignees(d.assignees || []);
      setSummary(d.summary || '');
      setImpact(d.impact || '');
      setConsequence(d.consequence || '');
      setFiveWhys(d.fiveWhys || '');
      setImmediateResolution(d.immediateResolution || '');
      setWentWell(d.wentWell || '');
      setCouldBeBetter(d.couldBeBetter || '');
      setGotLucky(d.gotLucky || '');
      if (d.actions) setActions(d.actions);
      if (d.timeline?.length) setTimeline(d.timeline);
      setOverrideBody(d.overrideBody ?? null);
      setOverrideOpen(d.overrideBody !== null);
      setDraftRestored(true);
      setDraftSavedAt(d.savedAt || null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const draft: DraftShape = {
        savedAt: new Date().toISOString(),
        title,
        severity,
        services,
        startedAt,
        detectedAt,
        mitigatedAt,
        resolvedAt,
        assignees,
        summary,
        impact,
        consequence,
        fiveWhys,
        immediateResolution,
        wentWell,
        couldBeBetter,
        gotLucky,
        actions,
        timeline,
        overrideBody,
      };
      if (isMeaningful(draft)) {
        writeDraft(draft);
        setDraftSavedAt(draft.savedAt);
      } else {
        clearDraft();
        setDraftSavedAt(null);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [
    open, title, severity, services,
    startedAt, detectedAt, mitigatedAt, resolvedAt, assignees,
    summary, impact, consequence, fiveWhys, immediateResolution,
    wentWell, couldBeBetter, gotLucky, actions, timeline, overrideBody,
  ]);

  const discardDraft = () => {
    clearDraft();
    reset();
  };

  const composedBody = useMemo(
    () =>
      composeBody({
        summary,
        impact,
        consequence,
        fiveWhys,
        immediateResolution,
        wentWell,
        couldBeBetter,
        gotLucky,
        actions,
        timeline,
      }),
    [
      summary,
      impact,
      consequence,
      fiveWhys,
      immediateResolution,
      wentWell,
      couldBeBetter,
      gotLucky,
      actions,
      timeline,
    ],
  );

  const finalBody = overrideBody ?? composedBody;

  const mutation = useMutation({
    mutationFn: () =>
      createRCA({
        title: title.trim(),
        body: finalBody.trim() || undefined,
        assignee_emails: assignees.map((a) => a.email),
        severity: severity ?? undefined,
        environment: 'prod',
        services_affected: services.length ? services : undefined,
        incident_started_at: startedAt || undefined,
        incident_detected_at: detectedAt || undefined,
        incident_mitigated_at: mitigatedAt || undefined,
        incident_resolved_at: resolvedAt || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['rcas'] });
      success('RCA created', created.title);
      clearDraft();
      reset();
      onClose();
      navigate(`/rcas/${created.id}`);
    },
    onError: (err) => {
      error('Could not create RCA', getErrorMessage(err));
    },
  });

  const titleValid = title.trim().length >= 3;
  const canSubmit = titleValid && severity !== null && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!titleValid || severity === null) return;
    mutation.mutate();
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    reset();
    onClose();
  };

  const updateActionRow = (
    cat: ActionCategory,
    idx: number,
    patch: Partial<ActionItemRow>,
  ) => {
    setActions((prev) => ({
      ...prev,
      [cat]: prev[cat].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const addActionRow = (cat: ActionCategory) => {
    setActions((prev) => ({ ...prev, [cat]: [...prev[cat], emptyActionRow()] }));
  };

  const removeActionRow = (cat: ActionCategory, idx: number) => {
    setActions((prev) => {
      const next = prev[cat].filter((_, i) => i !== idx);
      return { ...prev, [cat]: next.length === 0 ? [emptyActionRow()] : next };
    });
  };

  const updateTimelineRow = (idx: number, patch: Partial<TimelineRow>) => {
    setTimeline((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addTimelineRow = () => {
    setTimeline((prev) => [...prev, emptyTimelineRow()]);
  };

  const removeTimelineRow = (idx: number) => {
    setTimeline((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyTimelineRow()] : next;
    });
  };

  const ttd =
    startedAt && detectedAt ? formatDuration(startedAt, detectedAt) : null;
  const ttRespond =
    detectedAt && mitigatedAt ? formatDuration(detectedAt, mitigatedAt) : null;
  const ttResolve =
    startedAt && resolvedAt ? formatDuration(startedAt, resolvedAt) : null;

  const showTimingChips = ttd || ttRespond || ttResolve;

  const sectionStatus = {
    incident: titleValid || severity !== null || services.length > 0,
    times: !!(startedAt || detectedAt || mitigatedAt || resolvedAt),
    assignees: assignees.length > 0,
    summary: summary.trim().length > 0,
    impact: impact.trim().length > 0,
    consequence: consequence.trim().length > 0,
    fivewhys: fiveWhys.trim().length > 0,
    resolution: immediateResolution.trim().length > 0,
    takeaways: !!(wentWell.trim() || couldBeBetter.trim() || gotLucky.trim()),
    actions: Object.values(actions).some((rows) =>
      rows.some((r) => r.action.trim() || r.owner.trim()),
    ),
    timeline: timeline.some((r) => r.time.trim() || r.event.trim()),
  };

  const SECTION_NAV: { id: keyof typeof sectionStatus; label: string }[] = [
    { id: 'incident', label: 'Incident' },
    { id: 'times', label: 'Times' },
    { id: 'assignees', label: 'Assignees' },
    { id: 'summary', label: 'Summary' },
    { id: 'impact', label: 'Impact' },
    { id: 'consequence', label: 'Consequence' },
    { id: 'fivewhys', label: '5 Whys' },
    { id: 'resolution', label: 'Resolution' },
    { id: 'takeaways', label: 'Takeaways' },
    { id: 'actions', label: 'Action items' },
    { id: 'timeline', label: 'Timeline' },
  ];

  const filledCount = SECTION_NAV.filter((s) => sectionStatus[s.id]).length;

  const scrollPaneRef = useRef<HTMLDivElement | null>(null);
  const scrollToSection = (id: string) => {
    const el = document.getElementById(`rca-section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canSubmit) mutation.mutate();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="4xl"
      ariaLabel="Create new RCA"
      closeOnBackdrop={!mutation.isPending}
      closeOnEsc={!mutation.isPending}
    >
      <>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Plus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">New RCA</h3>
              <p className="text-[12px] text-slate-500">
                Capture the incident scaffold — fields here drive the body template and
                computed durations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {draftSavedAt && (
              <span
                className="text-[11px] text-slate-400 hidden md:inline-flex items-center gap-1"
                title={`Draft auto-saved at ${new Date(draftSavedAt).toLocaleTimeString()}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Draft saved
              </span>
            )}
            {draftRestored && (
              <button
                type="button"
                onClick={discardDraft}
                className="text-[12px] text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors"
                title="Discard restored draft and start fresh"
              >
                <RotateCcw className="w-3 h-3" />
                Start fresh
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col min-h-0 flex-1">
          <div className="flex flex-1 min-h-0">
            <nav
              aria-label="Form sections"
              className="hidden lg:flex flex-col w-[200px] shrink-0 border-r border-slate-200/70 px-2 py-5 overflow-y-auto custom-scrollbar bg-slate-50/40"
            >
              <div className="px-2 mb-2 text-[10px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
                Sections
              </div>
              {SECTION_NAV.map((s) => {
                const filled = sectionStatus[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`text-left text-[13px] py-1.5 px-2 rounded-md inline-flex items-center gap-2 transition-colors ${
                      filled
                        ? 'text-slate-900 hover:bg-slate-100 font-medium'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full inline-flex items-center justify-center shrink-0 transition-all ${
                        filled
                          ? 'bg-emerald-500 ring-2 ring-emerald-100'
                          : 'bg-white border border-slate-300'
                      }`}
                    >
                      {filled && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
                    </span>
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
              <div className="px-2 mt-3 pt-3 border-t border-slate-200/60 text-[11px] text-slate-500 tabular-nums">
                <span className="font-medium text-slate-700">{filledCount}</span>
                <span className="text-slate-400"> of {SECTION_NAV.length} filled</span>
              </div>
              <div className="px-2 mt-1 text-[10.5px] text-slate-400">
                Cmd / Ctrl + Enter to submit
              </div>
            </nav>
          <div ref={scrollPaneRef} className="flex-1 min-w-0 px-6 py-5 space-y-6 overflow-y-auto custom-scrollbar">
            <Section id="incident" label="Incident">
              <FieldLabel required>Title</FieldLabel>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Driver app — repeated 502s during 8pm peak"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-[15px] soft-focus focus:outline-none focus:border-blue-400 ${
                  touched && !titleValid ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                autoFocus
              />
              {touched && !titleValid && (
                <p className="text-xs text-red-500 mt-1">
                  Title must be at least 3 characters.
                </p>
              )}

              <div className="mt-5">
                <FieldLabel required>Severity</FieldLabel>
                <div className="[&_button]:px-3 [&_button]:py-1 [&_button]:text-[12px]">
                  <SeverityPicker value={severity} onChange={setSeverity} />
                </div>
                {touched && severity === null && (
                  <p className="text-xs text-red-500 mt-1">Pick a severity.</p>
                )}
              </div>

              <div className="mt-5">
                <FieldLabel>Services affected</FieldLabel>
                <TagInput
                  value={services}
                  onChange={setServices}
                  placeholder="dynamic-offer-driver, beckn-gateway… (Enter / comma)"
                />
              </div>
            </Section>

            <Section id="times" label="Incident times">
              <p className="text-[12px] text-slate-500 -mt-1 mb-3">
                Time to Detect / Respond / Resolve are computed live from these.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateTimeField label="Started" value={startedAt} onChange={setStartedAt} />
                <DateTimeField label="Detected" value={detectedAt} onChange={setDetectedAt} />
                <DateTimeField label="Mitigated" value={mitigatedAt} onChange={setMitigatedAt} />
                <DateTimeField label="Resolved" value={resolvedAt} onChange={setResolvedAt} />
              </div>
              {/* TTD/TTR/TTM chips render below — relies on ISO state above. */}
              {showTimingChips && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ttd && <TimingChip label="Time to Detect" value={ttd} />}
                  {ttRespond && <TimingChip label="Time to Respond" value={ttRespond} />}
                  {ttResolve && <TimingChip label="Time to Resolve" value={ttResolve} />}
                </div>
              )}
            </Section>

            <Section id="assignees" label="Assignees">
              <UserAutocomplete
                value={assignees}
                onChange={setAssignees}
                placeholder="Search teammates…"
              />
            </Section>

            <Section id="summary" label="Summary">
              <BodyTextarea
                value={summary}
                onChange={setSummary}
                placeholder="What happened, in 1-2 lines per incident."
              />
            </Section>

            <Section id="impact" label="What was the impact?">
              <BodyTextarea
                value={impact}
                onChange={setImpact}
                placeholder="User-facing impact."
              />
            </Section>

            <Section id="consequence" label="What is the consequence of impact?">
              <BodyTextarea
                value={consequence}
                onChange={setConsequence}
                placeholder="Business consequence: bounce, churn, drop, revenue."
              />
            </Section>

            <Section id="fivewhys" label="Root cause — Five Whys">
              <BodyTextarea
                value={fiveWhys}
                onChange={setFiveWhys}
                placeholder="Why? ... Why? ... (drill 5 levels)"
                minHeight={140}
              />
            </Section>

            <Section id="resolution" label="Immediate Resolution">
              <BodyTextarea
                value={immediateResolution}
                onChange={setImmediateResolution}
                placeholder="What stopped the bleeding."
              />
            </Section>

            <Section id="takeaways" label="Takeaways">
              <div className="space-y-4">
                <div>
                  <FieldLabel>What went well?</FieldLabel>
                  <BodyTextarea
                    value={wentWell}
                    onChange={setWentWell}
                    placeholder="Things that worked — runbook, comms, tooling, a teammate's quick thinking."
                    minHeight={80}
                  />
                </div>
                <div>
                  <FieldLabel>What could have been better?</FieldLabel>
                  <BodyTextarea
                    value={couldBeBetter}
                    onChange={setCouldBeBetter}
                    placeholder="Gaps in tooling, runbook, alerting, ownership, comms."
                    minHeight={80}
                  />
                </div>
                <div>
                  <FieldLabel>Where did we get lucky?</FieldLabel>
                  <BodyTextarea
                    value={gotLucky}
                    onChange={setGotLucky}
                    placeholder="Things that could have been much worse but weren't, by luck rather than design."
                    minHeight={80}
                  />
                </div>
              </div>
            </Section>

            <Section id="actions" label="Action Items">
              <div className="space-y-5">
                {ACTION_CATEGORIES.map((cat) => (
                  <ActionItemTable
                    key={cat}
                    category={cat}
                    rows={actions[cat]}
                    onUpdate={(idx, patch) => updateActionRow(cat, idx, patch)}
                    onAdd={() => addActionRow(cat)}
                    onRemove={(idx) => removeActionRow(cat, idx)}
                  />
                ))}
              </div>
            </Section>

            <Section id="timeline" label="Timeline">
              <TimelineTable
                rows={timeline}
                onUpdate={updateTimelineRow}
                onAdd={addTimelineRow}
                onRemove={removeTimelineRow}
              />
            </Section>

            <details
              className="border-t border-slate-200/60 pt-4"
              open={overrideOpen}
              onToggle={(e) => {
                const next = (e.target as HTMLDetailsElement).open;
                setOverrideOpen(next);
                if (!next) setOverrideBody(null);
              }}
            >
              <summary className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2 cursor-pointer select-none">
                Advanced: edit raw markdown
              </summary>
              <p className="text-[12px] text-slate-500 mb-2">
                Live preview of the composed body. Editing here overrides the structured
                fields until you collapse this section.
              </p>
              <textarea
                value={finalBody}
                onChange={(e) => setOverrideBody(e.target.value)}
                placeholder="Markdown supported"
                style={{ minHeight: 320 }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] leading-relaxed soft-focus focus:outline-none focus:border-blue-400 font-mono"
              />
            </details>

            {mutation.isError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-sm text-red-700">Failed to create RCA. Please try again.</p>
              </div>
            )}
          </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200/70 shrink-0 bg-slate-50/60 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 inline-flex items-center gap-2"
            >
              {mutation.isPending && (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {mutation.isPending ? 'Creating…' : 'Create RCA'}
            </button>
          </div>
        </form>
      </>
    </Modal>
  );
}

function Section({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id ? `rca-section-${id}` : undefined}
      style={{ scrollMarginTop: 12 }}
      className="border-t border-slate-200/60 pt-4 first:border-t-0 first:pt-0"
    >
      <h4 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        {label}
      </h4>
      {children}
    </section>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function TimingChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-slate-100 rounded-md px-2 py-1 text-[11px] text-slate-600">
      <span className="font-medium text-slate-700">{label}:</span>{' '}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

// Quick presets surfaced inside the DatePicker popover for incident times.
const DATETIME_PRESETS: DatePickerPreset[] = [
  { label: 'Now', compute: () => new Date() },
  { label: '−15m', compute: () => new Date(Date.now() - 15 * 60_000) },
  { label: '−1h', compute: () => new Date(Date.now() - 60 * 60_000) },
  { label: '−6h', compute: () => new Date(Date.now() - 6 * 60 * 60_000) },
];

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="block">
      <div className="text-[12px] font-medium text-slate-500 mb-1">{label}</div>
      <DatePicker
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
        withTime
        placeholder={`Pick ${label.toLowerCase()} time`}
        presets={DATETIME_PRESETS}
      />
    </div>
  );
}

function BodyTextarea({
  value,
  onChange,
  placeholder,
  minHeight = 100,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ minHeight }}
      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] leading-relaxed soft-focus focus:outline-none focus:border-blue-400"
    />
  );
}

function ActionItemTable({
  category,
  rows,
  onUpdate,
  onAdd,
  onRemove,
}: {
  category: ActionCategory;
  rows: ActionItemRow[];
  onUpdate: (idx: number, patch: Partial<ActionItemRow>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <h5 className="text-sm font-semibold text-slate-700 mb-2">{category}</h5>
      <div className="flex items-center gap-2 px-1 mb-1.5 text-[11px] text-slate-400 uppercase tracking-wide">
        <div className="flex-1">Action Item</div>
        <div className="w-32 shrink-0">Status</div>
        <div className="flex-1">Owner</div>
        <div className="w-7 shrink-0" />
      </div>
      <div className="space-y-1.5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={row.action}
              onChange={(e) => onUpdate(idx, { action: e.target.value })}
              placeholder="short description / Argus link"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm soft-focus focus:outline-none focus:border-blue-400"
            />
            <ActionStatusDropdown
              value={row.status}
              onChange={(s) => onUpdate(idx, { status: s })}
            />

            <input
              type="text"
              value={row.owner}
              onChange={(e) => onUpdate(idx, { owner: e.target.value })}
              placeholder="name / @mention / email"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm soft-focus focus:outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label="Remove row"
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded p-1 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="text-blue-600 hover:bg-blue-50 text-xs px-2 py-1 rounded inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add row
        </button>
      </div>
      <p className="text-[11px] text-slate-400 italic mt-1">
        Tip: file each item as an Argus issue and paste the link in the action column.
      </p>
    </div>
  );
}

const ACTION_STATUS_DOT: Record<ActionStatus, string> = {
  Open: 'bg-blue-500',
  'In Progress': 'bg-amber-500',
  'To Be Tested': 'bg-violet-500',
  Closed: 'bg-slate-400',
};

function ActionStatusDropdown({
  value,
  onChange,
}: {
  value: ActionStatus;
  onChange: (next: ActionStatus) => void;
}) {
  const trigger = (
    <button
      type="button"
      className="w-32 shrink-0 inline-flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-700 hover:border-slate-400 transition-all duration-150"
    >
      <span className="inline-flex items-center gap-1.5 truncate">
        <span className={`w-1.5 h-1.5 rounded-full ${ACTION_STATUS_DOT[value]}`} />
        <span className="truncate">{value}</span>
      </span>
      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    </button>
  );

  return (
    <Dropdown trigger={trigger} width={170}>
      {(close) => (
        <>
          {ACTION_STATUSES.map((s) => (
            <DropdownItem
              key={s}
              selected={s === value}
              onSelect={() => {
                onChange(s);
                close();
              }}
              leading={<span className={`w-1.5 h-1.5 rounded-full ${ACTION_STATUS_DOT[s]}`} />}
            >
              {s}
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function TimelineTable({
  rows,
  onUpdate,
  onAdd,
  onRemove,
}: {
  rows: TimelineRow[];
  onUpdate: (idx: number, patch: Partial<TimelineRow>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-1.5 text-[11px] text-slate-400 uppercase tracking-wide">
        <div className="w-44 shrink-0">Time</div>
        <div className="flex-1">Event</div>
        <div className="w-7 shrink-0" />
      </div>
      <div className="space-y-1.5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={row.time}
              onChange={(e) => onUpdate(idx, { time: e.target.value })}
              placeholder="07:11, 3 Jan / 18:00 UTC"
              className="w-44 shrink-0 px-3 py-2 rounded-lg border border-slate-300 text-sm soft-focus focus:outline-none focus:border-blue-400"
            />
            <input
              type="text"
              value={row.event}
              onChange={(e) => onUpdate(idx, { event: e.target.value })}
              placeholder="what happened"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm soft-focus focus:outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label="Remove row"
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded p-1 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="text-blue-600 hover:bg-blue-50 text-xs px-2 py-1 rounded inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add row
        </button>
      </div>
    </div>
  );
}
