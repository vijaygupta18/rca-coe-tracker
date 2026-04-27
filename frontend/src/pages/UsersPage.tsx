import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteAdminUser,
  fetchAdminUsers,
  patchAdminUser,
} from '../api/client';
import type { AdminUser } from '../api/types';
import Avatar from '../components/Avatar';
import Dropdown, { DropdownItem } from '../components/Dropdown';
import ConfirmDialog from '../components/ConfirmDialog';
import AddUserModal from '../components/AddUserModal';
import { getErrorMessage, useToast } from '../components/Toaster';
import { formatDate, timeAgo } from '../utils/format';

const PAGE_SIZE = 25;

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function NoAccess() {
  return (
    <div className="flex items-center justify-center px-6 py-20">
      <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">You don't have access</h1>
        <p className="text-[13px] text-slate-500 mt-2">
          User management is restricted to admins. If this looks wrong, ask another admin to grant
          you access.
        </p>
      </div>
    </div>
  );
}

interface RowMenuProps {
  user: AdminUser;
  selfEmail: string;
  onPromote: () => void;
  onDemote: () => void;
  onRemove: () => void;
}

function RowMenu({ user, selfEmail, onPromote, onDemote, onRemove }: RowMenuProps) {
  const isSelf = user.email === selfEmail;
  // Seed admin can never be demoted; the seed admin's row also can't be deleted server-side.
  const seedLocked = user.is_seed_admin && user.is_admin;
  const trigger = (
    <button
      type="button"
      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      aria-label="Row actions"
    >
      <MoreHorizontal className="w-4 h-4" />
    </button>
  );
  return (
    <Dropdown align="right" width={220} trigger={trigger}>
      {(close) => (
        <>
          {user.is_admin ? (
            <DropdownItem
              leading={<ShieldOff className="w-4 h-4 text-slate-500" />}
              disabled={seedLocked || isSelf}
              onSelect={() => {
                close();
                onDemote();
              }}
            >
              {seedLocked
                ? 'Demote (seed admin)'
                : isSelf
                ? 'Demote (yourself)'
                : 'Demote to member'}
            </DropdownItem>
          ) : (
            <DropdownItem
              leading={<UserPlus className="w-4 h-4 text-violet-600" />}
              onSelect={() => {
                close();
                onPromote();
              }}
            >
              Promote to admin
            </DropdownItem>
          )}
          <div className="h-px bg-slate-200/70 mx-1 my-1" aria-hidden />
          <DropdownItem
            danger
            disabled={isSelf || user.is_seed_admin}
            leading={<UserMinus className="w-4 h-4" />}
            onSelect={() => {
              close();
              onRemove();
            }}
          >
            {user.is_seed_admin
              ? 'Remove (seed admin)'
              : isSelf
              ? 'Remove (yourself)'
              : 'Remove user'}
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}

function RoleBadge({ user }: { user: AdminUser }) {
  if (user.is_admin) {
    const Icon = user.is_seed_admin ? Shield : ShieldCheck;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 text-[11px] font-semibold uppercase tracking-wide">
        <Icon className="w-3 h-3" />
        {user.is_seed_admin ? 'Seed admin' : 'Admin'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 text-[11px] font-medium uppercase tracking-wide">
      Member
    </span>
  );
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_1.4fr_120px_80px_120px_44px] items-center gap-4 px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <div className="skeleton h-8 w-8 rounded-full" />
        <div className="skeleton h-3 w-24" />
      </div>
      <div className="skeleton h-3 w-44" />
      <div className="skeleton h-5 w-16 rounded-full" />
      <div className="skeleton h-3 w-8" />
      <div className="skeleton h-3 w-14" />
      <div className="skeleton h-6 w-6 rounded-md" />
    </div>
  );
}

export default function UsersPage() {
  const { isAdmin, me } = useAuth();
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const pageParam = Math.max(1, Number(searchParams.get('page')) || 1);

  const [search, setSearch] = useState(qParam);
  const debouncedSearch = useDebounced(search, 200);

  // Sync URL when debounced search changes — also reset page on search change.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('q', debouncedSearch);
    else next.delete('q');
    if (debouncedSearch !== qParam) next.delete('page');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setSearch(qParam);
  }, [qParam]);

  const { data, isLoading, isFetching, error: loadError, refetch } = useQuery({
    queryKey: ['admin-users', debouncedSearch, pageParam],
    queryFn: () =>
      fetchAdminUsers({
        q: debouncedSearch || undefined,
        page: pageParam,
        page_size: PAGE_SIZE,
      }),
    enabled: isAdmin,
    placeholderData: (prev) => prev,
  });

  const [confirmRemove, setConfirmRemove] = useState<AdminUser | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const promote = useMutation({
    mutationFn: (email: string) => patchAdminUser(email, { is_admin: true }),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      success('Promoted to admin', u.name || u.email);
    },
    onError: (err) => error('Promote failed', getErrorMessage(err)),
  });

  const demote = useMutation({
    mutationFn: (email: string) => patchAdminUser(email, { is_admin: false }),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      success('Demoted to member', u.name || u.email);
    },
    onError: (err) => error('Demote failed', getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (email: string) => deleteAdminUser(email),
    onSuccess: (_void, email) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      success('User removed', email);
      setConfirmRemove(null);
    },
    onError: (err) => {
      error('Remove failed', getErrorMessage(err));
      setConfirmRemove(null);
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (pageParam - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, pageParam * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setSearchParams(next);
  };

  const removeWarning = useMemo(() => {
    if (!confirmRemove) return '';
    const parts: string[] = [];
    parts.push(`This will permanently remove ${confirmRemove.email} from the tracker.`);
    if (confirmRemove.rca_count > 0) {
      parts.push(
        `They are linked to ${confirmRemove.rca_count} RCA${
          confirmRemove.rca_count === 1 ? '' : 's'
        } (as creator or assignee). If they created any RCAs, the backend will block this and ask you to reassign first.`,
      );
    }
    return parts.join(' ');
  }, [confirmRemove]);

  if (!isAdmin) return <NoAccess />;

  return (
    <div className="px-5 md:px-8 py-6 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-slate-500" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
          </div>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage who can access the RCA tracker. Admins can promote, demote, or remove members.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
          >
            <UserPlus className="w-4 h-4" />
            Add user
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-full sm:w-[380px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email…"
            className="soft-focus w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="ml-auto text-[12px] text-slate-400 tabular-nums">
          {total > 0 ? `Showing ${start}–${end} of ${total}` : ''}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.4fr_120px_80px_120px_44px] gap-4 px-4 py-2 bg-slate-50/60 border-b border-slate-200/60 text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
          <div>User</div>
          <div>Email</div>
          <div>Role</div>
          <div className="text-right">RCAs</div>
          <div>Last seen</div>
          <div />
        </div>

        {isLoading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </>
        ) : loadError ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-sm text-red-600 font-medium mb-1">Couldn't load users</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center animate-fade-up">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {debouncedSearch ? 'No users match your search' : 'No users yet'}
            </h3>
            <p className="text-[13px] text-slate-500 mt-1.5">
              {debouncedSearch
                ? 'Try a different name or email.'
                : 'Users will appear here as they log in.'}
            </p>
          </div>
        ) : (
          items.map((u, idx) => (
            <div
              key={u.email}
              style={{ animationDelay: `${Math.min(idx, 12) * 18}ms` }}
              className="grid grid-cols-[1fr_1.4fr_120px_80px_120px_44px] items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors animate-stagger-in"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={u.name || u.email} size="sm" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {u.name || u.email.split('@')[0]}
                  </p>
                  <p className="text-[11px] text-slate-400 tabular-nums" title={formatDate(u.created_at)}>
                    Joined {timeAgo(u.created_at)}
                  </p>
                </div>
              </div>
              <div className="text-[12.5px] text-slate-600 truncate" title={u.email}>
                {u.email}
              </div>
              <div className="shrink-0">
                <RoleBadge user={u} />
              </div>
              <div className="shrink-0 text-right text-[12.5px] text-slate-700 tabular-nums">
                {u.rca_count > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-md bg-slate-100 font-medium">
                    {u.rca_count}
                  </span>
                ) : (
                  <span className="text-slate-300">0</span>
                )}
              </div>
              <div className="text-[12px] text-slate-500 tabular-nums" title={formatDate(u.last_seen_at)}>
                {timeAgo(u.last_seen_at)}
              </div>
              <div className="text-right">
                <RowMenu
                  user={u}
                  selfEmail={me?.email ?? ''}
                  onPromote={() => promote.mutate(u.email)}
                  onDemote={() => demote.mutate(u.email)}
                  onRemove={() => setConfirmRemove(u)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <span className="text-[12px] text-slate-400 tabular-nums mr-2">
            Page {pageParam} of {totalPages}
          </span>
          <button
            onClick={() => setPage(pageParam - 1)}
            disabled={pageParam <= 1}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <button
            onClick={() => setPage(pageParam + 1)}
            disabled={pageParam >= totalPages}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97] inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) remove.mutate(confirmRemove.email);
        }}
        pending={remove.isPending}
        variant="danger"
        title={confirmRemove ? `Remove ${confirmRemove.name || confirmRemove.email}?` : 'Remove user?'}
        description={removeWarning}
        confirmLabel="Remove user"
      />

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
