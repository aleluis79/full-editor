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
      store.setAuth(
        {
          id: (tokenParsed.sub as string) || '',
          keycloakId: (tokenParsed.sub as string) || '',
          email: (tokenParsed.email as string) || '',
          displayName: (tokenParsed.name as string) || (tokenParsed.preferred_username as string) || '',
        },
        keycloak.token || '',
      );
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
