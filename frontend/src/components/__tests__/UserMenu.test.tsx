import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserMenu } from '../UserMenu';
import { useThemeStore } from '../../stores/theme-store';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string) => {
      const fullKey = key.includes(':') ? key : `${ns}:${key}`;
      const labels: Record<string, string> = {
        'common:unknownUser': 'User',
        'common:signOut': 'Sign out',
        'common:theme': 'Theme',
        'common:themeLight': 'Light',
        'common:themeDark': 'Dark',
        'common:themeSystem': 'System',
      };
      return labels[fullKey] ?? key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
      languages: ['en'],
    },
  }),
}));

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      logout: vi.fn(),
    },
    initialized: true,
  }),
}));

vi.mock('../../stores/auth-store', () => ({
  useAuthStore: (selector?: (s: { user: { displayName: string } | null }) => unknown) => {
    const state = { user: { displayName: 'Alice' } };
    return selector ? selector(state) : state;
  },
}));

// ── Reset theme store before each test ──────────────────────────

beforeEach(() => {
  useThemeStore.setState({ preference: 'system', resolved: 'light' });
});

// ── Tests ───────────────────────────────────────────────────────

describe('UserMenu', () => {
  describe('existing functionality', () => {
    it('renders user display name', () => {
      render(<UserMenu />);
      // getByText throws if not found — no separate assertion needed
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    it('renders language switcher buttons with active state', () => {
      render(<UserMenu />);
      const enBtn = screen.getByText('EN');
      const esBtn = screen.getByText('ES');
      expect(enBtn).toBeTruthy();
      expect(esBtn).toBeTruthy();
      // EN is active by default (currentLang === 'en')
      expect(enBtn.className).toContain('active');
    });

    it('renders sign out button', () => {
      render(<UserMenu />);
      // The button renders a span with the label inside
      const logoutBtn = screen.getByText('Sign out');
      expect(logoutBtn).toBeTruthy();
    });
  });

  describe('theme toggle', () => {
    it('renders a single theme cycle button showing the current preference', () => {
      render(<UserMenu />);

      // Default is system → should show "System"
      const themeBtn = screen.getByText(/System/);
      expect(themeBtn).toBeTruthy();
      expect(themeBtn.tagName).toBe('BUTTON');
      // Only one theme button
      const buttons = document.querySelectorAll('.user-menu-theme button');
      expect(buttons.length).toBe(1);
    });

    it('cycles through system → light → dark → system on click', () => {
      render(<UserMenu />);

      // Start: system
      expect(useThemeStore.getState().preference).toBe('system');

      // Click: system → light
      fireEvent.click(screen.getByText(/System/));
      expect(useThemeStore.getState().preference).toBe('light');

      // Click: light → dark (component re-renders automatically via Zustand)
      fireEvent.click(screen.getByText(/Light/));
      expect(useThemeStore.getState().preference).toBe('dark');

      // Click: dark → system
      fireEvent.click(screen.getByText(/Dark/));
      expect(useThemeStore.getState().preference).toBe('system');
    });

    it('theme button is placed between language switcher and logout', () => {
      render(<UserMenu />);

      const userMenu = document.querySelector('.user-menu');
      expect(userMenu).not.toBeNull();

      const children = userMenu!.children;
      expect(children.length).toBeGreaterThanOrEqual(4);

      const langDiv = children[1] as HTMLElement;
      const themeDiv = children[2] as HTMLElement;
      const logoutBtn = children[3] as HTMLElement;

      expect(langDiv.classList.contains('user-menu-lang')).toBe(true);
      expect(themeDiv.classList.contains('user-menu-theme')).toBe(true);
      expect(logoutBtn.classList.contains('user-menu-logout')).toBe(true);
    });

    it('theme button label reflects the current preference', () => {
      useThemeStore.setState({ preference: 'dark', resolved: 'dark' });
      const { unmount } = render(<UserMenu />);
      expect(screen.getByText(/Dark/)).toBeTruthy();
      unmount();

      useThemeStore.setState({ preference: 'light', resolved: 'light' });
      render(<UserMenu />);
      expect(screen.getByText(/Light/)).toBeTruthy();
    });
  });
});
