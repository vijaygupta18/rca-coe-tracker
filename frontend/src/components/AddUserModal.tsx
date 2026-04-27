import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ShieldCheck, UserPlus } from 'lucide-react';
import Modal from './Modal';
import { createAdminUser } from '../api/client';
import { getErrorMessage, useToast } from './Toaster';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function AddUserModal({ open, onClose }: AddUserModalProps) {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverEmailError, setServerEmailError] = useState<string | null>(null);

  // Reset form when opened.
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setName('');
    setIsAdmin(false);
    setTouched(false);
    setServerEmailError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createAdminUser({
        email: email.trim().toLowerCase(),
        name: name.trim() || undefined,
        is_admin: isAdmin || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      success(`${created.name || created.email} added`);
      onClose();
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string; message?: string }>;
      const status = ax.response?.status;
      if (status === 400) {
        setServerEmailError(
          ax.response?.data?.detail || ax.response?.data?.message || 'Invalid email address.',
        );
        return;
      }
      if (status === 409) {
        setServerEmailError('A user with this email already exists.');
        return;
      }
      errorToast('Could not add user', getErrorMessage(err));
    },
  });

  const emailValid = EMAIL_REGEX.test(email.trim());
  const showEmailError =
    serverEmailError ?? (touched && email.length > 0 && !emailValid ? 'Enter a valid email address.' : null);

  const canSubmit = emailValid && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerEmailError(null);
    if (!emailValid) return;
    mutation.mutate();
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      ariaLabel="Add a user"
      closeOnBackdrop={!mutation.isPending}
      closeOnEsc={!mutation.isPending}
    >
      <form onSubmit={handleSubmit}>
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 ring-1 ring-blue-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-semibold text-slate-900 leading-snug">Add a user</h3>
              <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                They can be assigned to RCAs immediately. We'll DM them on Slack the moment someone
                assigns them.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (serverEmailError) setServerEmailError(null);
              }}
              onBlur={() => setTouched(true)}
              placeholder="teammate@example.com"
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border text-sm soft-focus focus:outline-none transition-all duration-150 ${
                showEmailError
                  ? 'border-red-300 bg-red-50/40 focus:border-red-400'
                  : 'border-slate-300 focus:border-blue-400'
              }`}
            />
            {showEmailError && (
              <p className="text-[12px] text-red-600 mt-1">{showEmailError}</p>
            )}
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
              Name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional — defaults to email local part"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm soft-focus focus:outline-none focus:border-blue-400 transition-all duration-150"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                Make admin
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                Admins can manage users, promote/demote, and remove members.
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200/70 bg-slate-50/60 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 inline-flex items-center gap-2"
          >
            {mutation.isPending && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {mutation.isPending ? 'Adding…' : 'Add user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
