import { useCallback } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Editor } from './components/Editor';
import { DocumentManager } from './components/DocumentManager';
import LoginPage from './components/LoginPage';
import { UserMenu } from './components/UserMenu';
import { useDocumentStore } from './stores/document-store';
import { useAuthStore } from './stores/auth-store';
import { useThemeInit } from './hooks/useThemeInit';

function App() {
  useThemeInit();
  const { initialized } = useKeycloak();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const currentDocId = useDocumentStore((s) => s.currentDocId);
  const loadDocument = useDocumentStore((s) => s.loadDocument);
  const resetEditor = useDocumentStore((s) => s.resetEditor);

  const handleOpenDocument = useCallback(
    async (id: string) => {
      try {
        await loadDocument(id);
      } catch {
        // error is logged in the store
      }
    },
    [loadDocument]
  );

  const handleCreateDocument = useCallback(
    async (id: string) => {
      try {
        await loadDocument(id);
      } catch {
        // error is logged in the store
      }
    },
    [loadDocument]
  );

  const handleBackToList = useCallback(() => {
    resetEditor();
  }, [resetEditor]);

  // Show nothing while Keycloak is initializing
  if (!initialized || !isInitialized) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Redirect to login page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app app--login">
        <LoginPage />
      </div>
    );
  }

  // Authenticated — show document manager or editor with user menu
  if (!currentDocId) {
    return (
      <div className="app app--auth">
        <div className="app-top-bar">
          <UserMenu />
        </div>
        <DocumentManager
          onOpenDocument={handleOpenDocument}
          onCreateDocument={handleCreateDocument}
        />
      </div>
    );
  }

  return (
    <div className="app app--auth">
      <div className="app-top-bar">
        <UserMenu />
      </div>
      <Editor onBack={handleBackToList} />
    </div>
  );
}

export default App;
