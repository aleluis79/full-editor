/**
 * LoginPage — modern login screen shown when the user is not authenticated.
 *
 * Displays a centered card with a sign-in button that redirects
 * to the Keycloak login page.
 */
import { useTranslation } from 'react-i18next';
import { useKeycloak } from '@react-keycloak/web';

export default function LoginPage() {
  const { t } = useTranslation('login');
  const { keycloak } = useKeycloak();

  const handleLogin = () => {
    keycloak?.login();
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <h1 className="login-title">{t('title')}</h1>
        <p className="login-subtitle">
          {t('subtitle')}<br />
          {t('description')}
        </p>

        <button className="login-button" onClick={handleLogin}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t('signInButton')}
        </button>

        <p className="login-footer">
          {t('securedBy')}
        </p>
      </div>
    </div>
  );
}
