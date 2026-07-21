/**
 * UserMenu — shows the authenticated user's name and a logout button.
 */
import { useKeycloak } from '@react-keycloak/web';
import { useAuthStore } from '../stores/auth-store';

export function UserMenu() {
  const { keycloak } = useKeycloak();
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    keycloak?.logout({ redirectUri: window.location.origin });
  };

  return (
    <div className="user-menu">
      <div className="user-menu-info">
        <div className="user-menu-avatar">
          {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
        </div>
        <span className="user-menu-name">{user?.displayName ?? 'User'}</span>
      </div>
      <button className="user-menu-logout" onClick={handleLogout} title="Sign out">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Sign out</span>
      </button>
    </div>
  );
}
