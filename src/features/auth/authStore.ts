import { create } from 'zustand';
import type { AuthProvider, Credentials, User } from './types';
import { MockAuthProvider } from './MockAuthProvider';

/** The active auth provider. Swap here (or behind an env flag) to go live. */
const provider: AuthProvider = new MockAuthProvider();

/**
 * Default workspace user used when no session is persisted. Present because the
 * login page is hidden from routing; remove once the auth flow is restored.
 */
const DEFAULT_USER: User = {
  id: 'u-default',
  name: 'NPHCDA Team',
  email: 'team@nphcda.gov.ng',
  role: 'National Administrator',
  avatarColor: '#00A859',
};

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  /** True once the persisted session has been checked on startup. */
  booted: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (creds: Credentials) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  booted: false,
  error: null,

  bootstrap: async () => {
    // The login flow is currently removed from routing (Home is the single
    // entry point), so there is no interactive way to establish a session.
    // Fall back to a default workspace user when none is persisted, keeping
    // the authenticated shell (profile menu, settings) fully functional.
    const existing = await provider.getCurrentUser();
    const user = existing ?? DEFAULT_USER;
    set({ user, status: 'authenticated', booted: true });
  },

  login: async (creds) => {
    set({ status: 'loading', error: null });
    try {
      const user = await provider.login(creds);
      set({ user, status: 'authenticated' });
      return true;
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
      return false;
    }
  },

  logout: async () => {
    await provider.logout();
    set({ user: null, status: 'idle' });
  },

  updateProfile: (patch) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ user: next });
    localStorage.setItem('nphcda-session', JSON.stringify(next));
  },
}));
