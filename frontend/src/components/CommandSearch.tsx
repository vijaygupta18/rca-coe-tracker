import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2, Search } from 'lucide-react';
import { fetchRCAs } from '../api/client';
import type { RCA } from '../api/types';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';
import { timeAgo } from '../utils/format';

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = window.setTimeout(() => setD(v), ms);
    return () => window.clearTimeout(t);
  }, [v, ms]);
  return d;
}

export default function CommandSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQ = useDebounced(q, 150);

  const { data, isFetching } = useQuery({
    queryKey: ['cmd-search', debouncedQ],
    queryFn: () => fetchRCAs(debouncedQ ? { q: debouncedQ } : {}),
    enabled: open,
    staleTime: 15_000,
  });

  // Global Cmd+K / Ctrl+K to open + custom event for buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('cmdsearch:open', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cmdsearch:open', onOpen);
    };
  }, []);

  // Helper for other components to open the palette.
  // Re-exported as openCommandSearch() below.

  useEffect(() => {
    if (!open) return;
    setQ('');
    setHighlight(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const items: RCA[] = data?.items ?? [];

  // Keep highlight in bounds when results change.
  useEffect(() => {
    if (highlight >= items.length) setHighlight(0);
  }, [items.length, highlight]);

  // Scroll highlighted row into view.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const row = root.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const close = () => setOpen(false);
  const pick = (rca: RCA) => {
    close();
    navigate(`/rcas/${rca.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items[highlight];
      if (target) pick(target);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlight(Math.max(0, items.length - 1));
    }
  };

  return (
    <Modal open={open} onClose={close} size="2xl" ariaLabel="Search RCAs" className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-200/70">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search RCAs by title, body, creator…"
          className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder-slate-400 focus:outline-none"
        />
        {isFetching && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
      </div>

      <div ref={listRef} className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-slate-500">
              {debouncedQ ? 'No RCAs match your search.' : 'Type to search RCAs.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((rca, idx) => {
              const isActive = idx === highlight;
              return (
                <li key={rca.id}>
                  <button
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pick(rca)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Avatar name={rca.creator_name || rca.creator_email} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isActive ? 'text-blue-900' : 'text-slate-900'
                        }`}
                      >
                        {rca.title}
                      </p>
                      <p className="text-[12px] text-slate-500 truncate">
                        {rca.creator_name} · {timeAgo(rca.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={rca.status} />
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-all ${
                        isActive ? 'text-blue-500 translate-x-0' : 'text-slate-300 -translate-x-0.5'
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-200/70 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <Hint label="↑↓" caption="navigate" />
          <Hint label="↵" caption="open" />
          <Hint label="Esc" caption="close" />
        </div>
        <span className="text-[11px] text-slate-400">
          {items.length} {items.length === 1 ? 'result' : 'results'}
        </span>
      </div>
    </Modal>
  );
}

export function openCommandSearch() {
  window.dispatchEvent(new CustomEvent('cmdsearch:open'));
}

function Hint({ label, caption }: { label: string; caption: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-600 shadow-sm">
        {label}
      </kbd>
      <span className="text-slate-500">{caption}</span>
    </span>
  );
}
