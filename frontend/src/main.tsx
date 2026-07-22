import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import Keycloak from 'keycloak-js';
import './index.css';
import App from './App.tsx';
import { useAuthStore } from './stores/auth-store.ts';

// Keycloak configuration — matches backend KEYCLOAK_* env vars
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'full-editor',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'full-editor-client',
});

/**
 * Callback fired by ReactKeycloakProvider on every token/update event.
 * Syncs the Keycloak auth state into our Zustand auth store.
 */
function handleKeycloakEvent(eventType: string, authError?: unknown) {
  const store = useAuthStore.getState();

  if (eventType === 'onAuthSuccess' || eventType === 'onAuthRefreshSuccess') {
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const tokenParsed = keycloak.tokenParsed as Record<string, unknown>;
      const token = keycloak.token || '';

      // Set initial auth from Keycloak token (uses sub as temporary id)
      store.setAuth(
        {
          id: (tokenParsed.sub as string) || '',
          keycloakId: (tokenParsed.sub as string) || '',
          email: (tokenParsed.email as string) || '',
          displayName: (tokenParsed.name as string) || (tokenParsed.preferred_username as string) || '',
        },
        token,
      );

      // Fetch the real internal DB user ID from /api/auth/me so that
      // author comparisons (e.g. comment.author_id) work correctly.
      fetch('http://localhost:8000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((me) => {
          if (me && me.id) {
            store.setAuth(
              {
                id: me.id,
                keycloakId: me.keycloak_id || (tokenParsed.sub as string) || '',
                email: me.email || '',
                displayName: me.display_name || '',
              },
              token,
            );
          }
        })
        .catch(() => {
          // Keep the initial Keycloak-based auth as fallback
        });
    }
  }

  if (eventType === 'onAuthError' || eventType === 'onAuthLogout') {
    store.clearAuth();
  }

  if (eventType === 'onReady') {
    store.setInitialized();
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactKeycloakProvider
      authClient={keycloak}
      onEvent={handleKeycloakEvent}
      initOptions={{
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          window.location.origin + '/silent-check-sso.html',
        pkceMethod: 'S256',
      }}
    >
      <App />
    </ReactKeycloakProvider>
  </StrictMode>,
);
