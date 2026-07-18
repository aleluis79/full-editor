/**
 * API Client for Full Editor Backend
 */

const API_BASE = 'http://localhost:8000/api';

export interface DocumentData {
  id: string;
  title: string;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentData {
  title?: string;
  content?: Record<string, unknown>;
}

export interface UpdateDocumentData {
  title?: string;
  content?: Record<string, unknown>;
}

/**
 * Fetch all documents
 */
export async function fetchDocuments(): Promise<DocumentData[]> {
  const response = await fetch(`${API_BASE}/documents/`);
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  return response.json();
}

/**
 * Fetch a single document by ID
 */
export async function fetchDocument(id: string): Promise<DocumentData> {
  const response = await fetch(`${API_BASE}/documents/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }
  return response.json();
}

/**
 * Create a new document
 */
export async function createDocument(data: CreateDocumentData = {}): Promise<DocumentData> {
  const response = await fetch(`${API_BASE}/documents/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create document');
  }
  return response.json();
}

/**
 * Update an existing document
 */
export async function updateDocument(
  id: string,
  data: UpdateDocumentData
): Promise<DocumentData> {
  const response = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update document');
  }
  return response.json();
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

// ── Image Upload ────────────────────────────────────────────────

/**
 * Upload an image file to the backend and return its URL path.
 *
 * POST /api/images/upload as multipart/form-data.
 * Returns URL string like "/uploads/images/uuid.ext".
 * Throws on validation or server error.
 */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/images/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  const data = await response.json();
  return data.url;
}

// ── PDF Export ──────────────────────────────────────────────────

export interface ExportPDFData {
  content: Record<string, unknown>;
  paper_size?: string;
  orientation?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  page_breaks?: string[];
}

/**
 * Export document content to PDF and download it.
 */
export async function exportPDF(
  data: ExportPDFData,
  filename: string = 'document.pdf'
): Promise<void> {
  const response = await fetch(`${API_BASE}/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }

  // Trigger file download from the blob
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
