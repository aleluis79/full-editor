import { useCallback } from 'react';
import { Editor } from './components/Editor';
import { DocumentManager } from './components/DocumentManager';
import { useDocumentStore } from './stores/document-store';

function App() {
  const currentDocId = useDocumentStore((s) => s.currentDocId);
  const loadDocument = useDocumentStore((s) => s.loadDocument);
  const newDocument = useDocumentStore((s) => s.newDocument);
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

  if (!currentDocId) {
    return (
      <div className="app">
        <DocumentManager
          onOpenDocument={handleOpenDocument}
          onCreateDocument={handleCreateDocument}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Editor onBack={handleBackToList} />
    </div>
  );
}

export default App;
