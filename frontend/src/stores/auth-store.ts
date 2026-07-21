/**
 * Zustand auth store — exposes authenticated user info, login state, and access token.
 *
 * The store is populated by ReactKeycloakProvider callbacks. Components read
 * from this store instead of importing keycloak-js directly.
 */
import { create } from 'zustand';

export interface UserInfo {
  id: string;
  keycloakId: string;
  email: string;
  displayName: string;
}

export interface AuthState {
  /** Whether the user has completed the OIDC login flow. */
  isAuthenticated: boolean;
  /** Whether auth is still initializing (checking session). */
  isInitialized: boolean;
  /** The authenticated user's info, or null if not logged in. */
  user: UserInfo | null;
  /** The raw Keycloak access token string, or null. */
  token: string | null;

  /** Set auth state from ReactKeycloakProvider events. */
  setAuth: (user: UserInfo, token: string) => void;
  /** Clear auth state on logout or token expiry. */
  clearAuth: () => void;
  /** Mark auth as initialized (first check complete). */
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isInitialized: false,
  user: null,
  token: null,

  setAuth: (user, token) =>
    set({
      isAuthenticated: true,
      isInitialized: true,
      user,
      token,
    }),

  clearAuth: () =>
    set({
      isAuthenticated: false,
      user: null,
      token: null,
    }),

  setInitialized: () =>
    set({ isInitialized: true }),
}));
