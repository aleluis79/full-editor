/**
 * UserMenu — shows the authenticated user's name, language switcher, theme toggle, and a logout button.
 */
import { useTranslation } from 'react-i18next';
import { useKeycloak } from '@react-keycloak/web';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { useCallback } from 'react';

export function UserMenu() {
  const { t, i18n } = useTranslation('common');
  const { keycloak } = useKeycloak();
  const user = useAuthStore((s) => s.user);
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  const handleLogout = () => {
    keycloak?.logout({ redirectUri: window.location.origin });
  };

  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

  const switchLanguage = useCallback(
    (lng: string) => {
      i18n.changeLanguage(lng);
    },
    [i18n],
  );

  const themeOptions = [
    { value: 'light' as const, key: 'themeLight', emoji: '☀️' },
    { value: 'dark' as const, key: 'themeDark', emoji: '🌙' },
    { value: 'system' as const, key: 'themeSystem', emoji: '💻' },
  ];

  const currentThemeIndex = themeOptions.findIndex((opt) => opt.value === themePreference);
  const currentTheme = themeOptions[currentThemeIndex] ?? themeOptions[0];

  const cycleTheme = () => {
    const next = themeOptions[(currentThemeIndex + 1) % themeOptions.length];
    setThemePreference(next.value);
  };

  return (
    <div className="user-menu">
      <div className="user-menu-info">
        <div className="user-menu-avatar">
          {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
        </div>
        <span className="user-menu-name">{user?.displayName ?? t('unknownUser')}</span>
      </div>

      <div className="user-menu-lang">
        <button
          className={currentLang === 'en' ? 'active' : ''}
          onClick={() => switchLanguage('en')}
          title="English"
        >
          EN
        </button>
        <button
          className={currentLang === 'es' ? 'active' : ''}
          onClick={() => switchLanguage('es')}
          title="Español"
        >
          ES
        </button>
      </div>

      <div className="user-menu-theme">
        <button
          className="theme-cycle-btn"
          onClick={cycleTheme}
          title={t('theme')}
        >
          {currentTheme.emoji} {t(currentTheme.key)}
        </button>
      </div>

      <button className="user-menu-logout" onClick={handleLogout} title={t('signOut')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{t('signOut')}</span>
      </button>
    </div>
  );
}
