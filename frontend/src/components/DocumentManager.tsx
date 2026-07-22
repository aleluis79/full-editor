import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('document');
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
    } catch {
      setError('ERROR_LOAD_DOCUMENTS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleCreate = async () => {
    try {
      const doc = await createDocument({ title: t('untitled'), content: {} });
      onCreateDocument(doc.id);
    } catch {
      setError('ERROR_CREATE_DOCUMENT');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError('ERROR_DELETE_DOCUMENT');
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
        <div className="doc-manager-loading">{t('loadingDocuments')}</div>
      </div>
    );
  }

  return (
    <div className="doc-manager">
      <div className="doc-manager-header">
        <h1>{t('appTitle')}</h1>
        <button className="doc-manager-new-btn" onClick={handleCreate}>
          {t('newDocument')}
        </button>
      </div>

      {error && <div className="doc-manager-error">{t(`errors:${error}`, { defaultValue: error })}</div>}

      {/* My documents */}
      <section className="doc-manager-section">
        <h2 className="doc-manager-section-title">{t('myDocuments')}</h2>
        {documents.length === 0 ? (
          <div className="doc-manager-empty">
            <p>{t('noDocumentsYet')}</p>
            <p>{t('createOneToStart')}</p>
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
                    {t('lastModified')} {formatDate(doc.updated_at)}
                  </span>
                </div>
                <button
                  className="doc-manager-item-delete"
                  onClick={(e) => handleDelete(doc.id, e)}
                  title={t('deleteDocument')}
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
          <h2 className="doc-manager-section-title">{t('sharedWithMe')}</h2>
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
                    {t('sharedBy')} {sd.shared_by_display_name} · {sd.permission === 'write' ? t('canEdit') : t('canRead')}
                  </span>
                </div>
                <div className="doc-manager-item-shared-badge">
                  {sd.permission === 'write' ? t('edit') : t('view')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
