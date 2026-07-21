import { useState, useEffect } from 'react';
import {
  fetchDocuments,
  deleteDocument,
  createDocument,
  fetchSharedWithMe,
  type DocumentData,
  type SharedWithMeDocument,
} from '../api/client';
import { Delete } from './icons';

interface DocumentManagerProps {
  onOpenDocument: (id: string) => void;
  onCreateDocument: (id: string) => void;
}

export function DocumentManager({ onOpenDocument, onCreateDocument }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [sharedDocs, setSharedDocs] = useState<SharedWithMeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, shared] = await Promise.all([
        fetchDocuments(),
        fetchSharedWithMe(),
      ]);
      setDocuments(docs);
      setSharedDocs(shared);
    } catch (err) {
      setError('No se pudieron cargar los documentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleCreate = async () => {
    try {
      const doc = await createDocument({ title: 'Untitled Document', content: {} });
      onCreateDocument(doc.id);
    } catch {
      setError('No se pudo crear el documento');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError('No se pudo eliminar el documento');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="doc-manager">
        <div className="doc-manager-loading">Cargando documentos...</div>
      </div>
    );
  }

  return (
    <div className="doc-manager">
      <div className="doc-manager-header">
        <h1>Full Editor</h1>
        <button className="doc-manager-new-btn" onClick={handleCreate}>
          + Nuevo documento
        </button>
      </div>

      {error && <div className="doc-manager-error">{error}</div>}

      {/* My documents */}
      <section className="doc-manager-section">
        <h2 className="doc-manager-section-title">My documents</h2>
        {documents.length === 0 ? (
          <div className="doc-manager-empty">
            <p>No tenés documentos todavía.</p>
            <p>Creá uno nuevo para empezar a escribir.</p>
          </div>
        ) : (
          <div className="doc-manager-list">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="doc-manager-item"
                onClick={() => onOpenDocument(doc.id)}
              >
                <div className="doc-manager-item-info">
                  <span className="doc-manager-item-title">{doc.title}</span>
                  <span className="doc-manager-item-date">
                    Última modificación: {formatDate(doc.updated_at)}
                  </span>
                </div>
                <button
                  className="doc-manager-item-delete"
                  onClick={(e) => handleDelete(doc.id, e)}
                  title="Eliminar documento"
                >
                  <Delete size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shared with me */}
      {sharedDocs.length > 0 && (
        <section className="doc-manager-section">
          <h2 className="doc-manager-section-title">Shared with me</h2>
          <div className="doc-manager-list">
            {sharedDocs.map((sd) => (
              <div
                key={sd.id}
                className="doc-manager-item"
                onClick={() => onOpenDocument(sd.document_id)}
              >
                <div className="doc-manager-item-info">
                  <span className="doc-manager-item-title">{sd.title}</span>
                  <span className="doc-manager-item-date">
                    Shared by {sd.shared_by_display_name} · {sd.permission === 'write' ? 'Can edit' : 'Can read'}
                  </span>
                </div>
                <div className="doc-manager-item-shared-badge">
                  {sd.permission === 'write' ? 'Edit' : 'View'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
