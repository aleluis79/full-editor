/**
 * API Client for Full Editor Backend
 *
 * Injects the Keycloak Bearer token from the auth store on every request.
 */
import { useAuthStore } from '../stores/auth-store';

const API_BASE = 'http://localhost:8000/api';

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(url, { ...options, headers });
}

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
 * Fetch all documents owned by the current user.
 */
export async function fetchDocuments(): Promise<DocumentData[]> {
  const response = await authFetch(`${API_BASE}/documents/`);
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  return response.json();
}

/**
 * Fetch a single document by ID.
 */
export async function fetchDocument(id: string): Promise<DocumentData> {
  const response = await authFetch(`${API_BASE}/documents/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }
  return response.json();
}

/**
 * Create a new document.
 */
export async function createDocument(data: CreateDocumentData = {}): Promise<DocumentData> {
  const response = await authFetch(`${API_BASE}/documents/`, {
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
 * Update an existing document.
 */
export async function updateDocument(
  id: string,
  data: UpdateDocumentData
): Promise<DocumentData> {
  const response = await authFetch(`${API_BASE}/documents/${id}`, {
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
 * Delete a document.
 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await authFetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

// ── Image Upload ────────────────────────────────────────────────

/**
 * Upload an image file to the backend and return its URL path.
 */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const headers = getAuthHeaders();
  const response = await fetch(`${API_BASE}/images/upload`, {
    method: 'POST',
    headers: { ...headers },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  const data = await response.json();
  return data.url;
}

// ── Sharing ─────────────────────────────────────────────────────

export interface ShareData {
  id: string;
  document_id: string;
  shared_with_user_id: string;
  shared_with_email: string;
  shared_with_display_name: string;
  permission: string;
  created_at: string;
}

export interface SharedWithMeDocument {
  id: string;
  document_id: string;
  title: string;
  permission: string;
  shared_by_user_id: string;
  shared_by_display_name: string;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  keycloak_id: string;
  email: string;
  display_name: string;
}

/**
 * List all shares for a document.
 */
export async function listShares(documentId: string): Promise<ShareData[]> {
  const response = await authFetch(`${API_BASE}/shares/?document_id=${documentId}`);
  if (!response.ok) throw new Error('Failed to list shares');
  return response.json();
}

/**
 * Share a document with another user.
 */
export async function createShare(
  documentId: string,
  userId: string,
  permission: 'read' | 'write',
): Promise<ShareData> {
  const response = await authFetch(`${API_BASE}/shares/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      shared_with_user_id: userId,
      permission,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to share' }));
    throw new Error(err.detail || 'Failed to share');
  }
  return response.json();
}

/**
 * Revoke a share.
 */
export async function revokeShare(shareId: string): Promise<void> {
  const response = await authFetch(`${API_BASE}/shares/${shareId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to revoke share');
}

/**
 * Search users by email or display name.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const response = await authFetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Failed to search users');
  return response.json();
}

/**
 * Fetch documents shared with the current user.
 */
export async function fetchSharedWithMe(): Promise<SharedWithMeDocument[]> {
  const response = await authFetch(`${API_BASE}/documents/shared-with-me`);
  if (!response.ok) throw new Error('Failed to fetch shared documents');
  return response.json();
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
  const response = await authFetch(`${API_BASE}/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }

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
