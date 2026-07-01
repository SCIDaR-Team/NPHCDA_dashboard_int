import type { AuthProvider, Credentials, User } from './types';

const STORAGE_KEY = 'nphcda-session';
const LATENCY = 600;

/** Demo accounts. In production these checks happen server-side. */
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'admin@nphcda.gov.ng': {
    password: 'nphcda2026',
    user: {
      id: 'u-admin',
      name: 'Dr. Amina Bello',
      email: 'admin@nphcda.gov.ng',
      role: 'National Administrator',
      avatarColor: '#00A859',
    },
  },
  'analyst@nphcda.gov.ng': {
    password: 'nphcda2026',
    user: {
      id: 'u-analyst',
      name: 'Tunde Okafor',
      email: 'analyst@nphcda.gov.ng',
      role: 'Data Analyst',
      avatarColor: '#3D7BB5',
    },
  },
};

/**
 * Client-side mock auth. Validates against demo accounts and persists a session
 * to localStorage. Any email also works with the universal demo password "demo".
 */
export class MockAuthProvider implements AuthProvider {
  async login(creds: Credentials): Promise<User> {
    await new Promise((r) => setTimeout(r, LATENCY));
    const email = creds.email.trim().toLowerCase();

    const known = DEMO_USERS[email];
    if (known && known.password === creds.password) {
      this.persist(known.user);
      return known.user;
    }

    // Convenience: any email + "demo" signs in as a guest analyst.
    if (creds.password === 'demo' && /\S+@\S+\.\S+/.test(email)) {
      const user: User = {
        id: 'u-' + email,
        name: email
          .split('@')[0]
          .split(/[.\-_]/)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' '),
        email,
        role: 'Guest Analyst',
        avatarColor: '#C9A227',
      };
      this.persist(user);
      return user;
    }

    throw new Error('Invalid email or password. Try the demo credentials below.');
  }

  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }

  async getCurrentUser(): Promise<User | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private persist(user: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export const DEMO_CREDENTIALS = {
  email: 'admin@nphcda.gov.ng',
  password: 'nphcda2026',
};
