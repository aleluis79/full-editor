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
  can_write?: boolean;
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

// ── Comments ───────────────────────────────────────────────────

export interface CommentData {
  id: string;
  document_id: string;
  block_id: string;
  author_id: string;
  author_display_name: string;
  author_email: string;
  content: string;
  parent_id: string | null;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  replies: CommentData[];
}

export interface CommentCreateData {
  block_id: string;
  content: string;
  parent_id?: string;
}

export interface CommentUpdateData {
  content?: string;
  resolved?: boolean;
}

/**
 * Fetch all comments for a document.
 */
export async function fetchComments(docId: string): Promise<CommentData[]> {
  const response = await authFetch(`${API_BASE}/documents/${docId}/comments`);
  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }
  return response.json();
}

/**
 * Create a new comment on a block.
 */
export async function createComment(
  docId: string,
  data: CommentCreateData,
): Promise<CommentData> {
  const response = await authFetch(`${API_BASE}/documents/${docId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to create comment' }));
    throw new Error(err.detail || 'Failed to create comment');
  }
  return response.json();
}

/**
 * Create a reply to an existing comment.
 */
export async function createReply(
  docId: string,
  commentId: string,
  data: CommentCreateData,
): Promise<CommentData> {
  const response = await authFetch(
    `${API_BASE}/documents/${docId}/comments/${commentId}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to create reply' }));
    throw new Error(err.detail || 'Failed to create reply');
  }
  return response.json();
}

/**
 * Update a comment's content or resolved status.
 */
export async function updateComment(
  docId: string,
  commentId: string,
  data: CommentUpdateData,
): Promise<CommentData> {
  const response = await authFetch(
    `${API_BASE}/documents/${docId}/comments/${commentId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update comment' }));
    throw new Error(err.detail || 'Failed to update comment');
  }
  return response.json();
}

/**
 * Delete a comment.
 */
export async function deleteComment(
  docId: string,
  commentId: string,
): Promise<void> {
  const response = await authFetch(
    `${API_BASE}/documents/${docId}/comments/${commentId}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error('Failed to delete comment');
  }
}

/**
 * Toggle the resolved status of a comment.
 */
export async function resolveComment(
  docId: string,
  commentId: string,
): Promise<CommentData> {
  const response = await authFetch(
    `${API_BASE}/documents/${docId}/comments/${commentId}/resolve`,
    { method: 'PATCH' },
  );
  if (!response.ok) {
    throw new Error('Failed to resolve comment');
  }
  return response.json();
}
