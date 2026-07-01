export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Tailwind-ish gradient seed for the avatar. */
  avatarColor: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Authentication contract. The app talks only to this interface, so swapping the
 * mock for a real identity provider (OIDC, your backend, etc.) is a one-file change.
 */
export interface AuthProvider {
  login(creds: Credentials): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
