/**
 * Document service
 * M1-T3: Document CRUD operations
 */

import { query } from '../lib/db.js';

export type DocumentType =
  | 'auto_policy'
  | 'home_policy'
  | 'life_insurance'
  | 'warranty'
  | 'tax'
  | 'receipt'
  | 'other'
  | 'unknown';

export type DocumentStatus =
  | 'pending'
  | 'parsing'
  | 'ready'
  | 'needs_review'
  | 'failed';

export type DocumentSource = 'upload' | 'share_sheet' | 'email';

export interface Document {
  id: string;
  user_id: string;
  document_type: DocumentType;
  status: DocumentStatus;
  source: DocumentSource;
  title: string | null;
  storage_key: string;
  content_type: string;
  byte_size: number | null;
  checksum_sha256: string | null;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentParams {
  userId: string;
  documentType: DocumentType;
  source: DocumentSource;
  storageKey: string;
  contentType?: string;
  byteSize: number;
  checksum?: string;
}

/**
 * Create a new document record
 */
export async function createDocument(
  params: CreateDocumentParams
): Promise<Document> {
  const result = await query<Document>(
    `
    INSERT INTO documents (
      user_id,
      document_type,
      status,
      source,
      storage_key,
      content_type,
      byte_size,
      checksum_sha256
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      params.userId,
      params.documentType,
      'pending', // Initial status
      params.source,
      params.storageKey,
      params.contentType || 'application/pdf',
      params.byteSize,
      params.checksum || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get a document by ID and user ID (for authorization)
 */
export async function getDocumentByIdAndUser(
  documentId: string,
  userId: string
): Promise<Document | null> {
  const result = await query<Document>(
    `
    SELECT * FROM documents
    WHERE id = $1 AND user_id = $2
    `,
    [documentId, userId]
  );

  return result.rows[0] || null;
}

/**
 * List documents for a user
 */
export async function listDocuments(
  userId: string,
  status?: DocumentStatus,
  limit: number = 50
): Promise<Document[]> {
  const statusCondition = status ? 'AND status = $2' : '';
  const params = status ? [userId, status, limit] : [userId, limit];
  const limitParamIndex = status ? 3 : 2;

  const result = await query<Document>(
    `
    SELECT * FROM documents
    WHERE user_id = $1
    ${statusCondition}
    ORDER BY created_at DESC
    LIMIT $${limitParamIndex}
    `,
    params
  );

  return result.rows;
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus
): Promise<void> {
  await query(
    `
    UPDATE documents
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [status, documentId]
  );
}

/**
 * Delete a document (hard delete)
 */
export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `
    DELETE FROM documents
    WHERE id = $1 AND user_id = $2
    `,
    [documentId, userId]
  );

  return (result.rowCount || 0) > 0;
}
