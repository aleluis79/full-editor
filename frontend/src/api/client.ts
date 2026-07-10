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
