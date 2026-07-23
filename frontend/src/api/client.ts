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
    throw new Error('ERROR_FETCH_DOCUMENTS');
  }
  return response.json();
}

/**
 * Fetch a single document by ID.
 */
export async function fetchDocument(id: string): Promise<DocumentData> {
  const response = await authFetch(`${API_BASE}/documents/${id}`);
  if (!response.ok) {
    throw new Error('ERROR_FETCH_DOCUMENT');
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
    throw new Error('ERROR_CREATE_DOCUMENT');
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
    throw new Error('ERROR_UPDATE_DOCUMENT');
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
    throw new Error('ERROR_DELETE_DOCUMENT');
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
    const err = await response.json().catch(() => ({ detail: 'ERROR_UPLOAD_FAILED' }));
    throw new Error(err.detail || 'ERROR_UPLOAD_FAILED');
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
  if (!response.ok) throw new Error('ERROR_LIST_SHARES');
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
    const err = await response.json().catch(() => ({ detail: 'ERROR_CREATE_SHARE' }));
    throw new Error(err.detail || 'ERROR_CREATE_SHARE');
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
  if (!response.ok) throw new Error('ERROR_REVOKE_SHARE');
}

/**
 * Search users by email or display name.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const response = await authFetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('ERROR_SEARCH_USERS');
  return response.json();
}

/**
 * Fetch documents shared with the current user.
 */
export async function fetchSharedWithMe(): Promise<SharedWithMeDocument[]> {
  const response = await authFetch(`${API_BASE}/documents/shared-with-me`);
  if (!response.ok) throw new Error('ERROR_FETCH_SHARED_DOCUMENTS');
  return response.json();
}

// ── PDF Export ──────────────────────────────────────────────────

export interface HeaderFooterRun {
  content: string;
  marks?: string[];
  attrs?: Record<string, any>;
}

export interface HeaderFooterContent {
  runs: HeaderFooterRun[];
  height: number;
  attrs?: {
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface HeaderFooterPayload {
  enabled: boolean;
  firstPageDifferent: boolean;
  header: HeaderFooterContent;
  footer: HeaderFooterContent;
  scope?: 'all' | 'exceptFirst' | 'firstOnly';
}

export interface ExportPDFData {
  content: Record<string, unknown>;
  paper_size?: string;
  orientation?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  page_breaks?: string[];
  header_footer?: HeaderFooterPayload;
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
    throw new Error('ERROR_EXPORT_PDF');
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
    throw new Error('ERROR_FETCH_COMMENTS');
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
    const err = await response.json().catch(() => ({ detail: 'ERROR_CREATE_COMMENT' }));
    throw new Error(err.detail || 'ERROR_CREATE_COMMENT');
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
    const err = await response.json().catch(() => ({ detail: 'ERROR_CREATE_REPLY' }));
    throw new Error(err.detail || 'ERROR_CREATE_REPLY');
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
    const err = await response.json().catch(() => ({ detail: 'ERROR_UPDATE_COMMENT' }));
    throw new Error(err.detail || 'ERROR_UPDATE_COMMENT');
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
    throw new Error('ERROR_DELETE_COMMENT');
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
    throw new Error('ERROR_RESOLVE_COMMENT');
  }
  return response.json();
}

// ── Custom Words (Spell Check Dictionary) ──────────────────────

export interface CustomWordData {
  id: string;
  user_id: string;
  word: string;
  lang: string;
  created_at: string;
}

/**
 * Fetch all custom dictionary words for the current user.
 */
export async function fetchCustomWords(): Promise<CustomWordData[]> {
  const response = await authFetch(`${API_BASE}/v1/custom-words`);
  if (!response.ok) {
    throw new Error('ERROR_FETCH_CUSTOM_WORDS');
  }
  return response.json();
}

/**
 * Add a word to the current user's custom dictionary.
 */
export async function addCustomWord(word: string, lang: string): Promise<CustomWordData> {
  const response = await authFetch(`${API_BASE}/v1/custom-words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, lang }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'ERROR_ADD_CUSTOM_WORD' }));
    throw new Error(err.detail || 'ERROR_ADD_CUSTOM_WORD');
  }
  return response.json();
}

/**
 * Delete a custom dictionary word by ID.
 */
export async function deleteCustomWord(wordId: string): Promise<void> {
  const response = await authFetch(`${API_BASE}/v1/custom-words/${wordId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('ERROR_DELETE_CUSTOM_WORD');
  }
}
