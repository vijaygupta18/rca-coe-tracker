import { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { fetchMe } from '../api/client';
import type { MeResponse, RCA } from '../api/types';

interface AuthContextType {
  me: MeResponse | null;
  isLoading: boolean;
  isAdmin: boolean;
  canEdit: (rca: RCA) => boolean;
  canDelete: (rca: RCA) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const me = data ?? null;
  const isAdmin = me?.is_admin ?? false;

  const canEdit = useCallback(
    (rca: RCA) => rca.can_edit,
    [],
  );

  const canDelete = useCallback(
    (rca: RCA) => rca.can_delete,
    [],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401 || status === 403) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-50 px-6">
          <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">You don't have access</h1>
            <p className="text-[13px] text-slate-500 mt-2">
              Your account isn't authorized to view the RCA COE Tracker. If this looks wrong, ask an
              admin to grant you access through Pomerium.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 px-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-50 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Couldn't load your session</h1>
          <p className="text-[13px] text-slate-500 mt-2">
            Try refreshing the page in a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ me, isLoading, isAdmin, canEdit, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
