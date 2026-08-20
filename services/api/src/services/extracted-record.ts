/**
 * Extracted Record service
 * M1-T4: CRUD operations for parsed document fields
 */

import { query } from '../lib/db.js';

export type AmountFrequency =
  | 'one_time'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'unknown';

/** Mirrors openapi.yaml FieldValue.value: scalar, or an array of scalars/flat objects (one level deep). */
export type FieldScalarValue = string | number | boolean | null;
export type FieldArrayItemValue = FieldScalarValue | Record<string, FieldScalarValue>;

export interface FieldValue {
  key: string;
  label: string;
  value: FieldScalarValue | FieldArrayItemValue[];
  confidence?: number;
  needsReview?: boolean;
  source?: string;
  /** Review UI accordion section; present on scalar fields only (document-type-modules.md rule 6). */
  group?: string;
  /**
   * Object-array fields only: the item shape (key/label/type per property), so the
   * correction UI can build a blank "add item" form even when the array currently has
   * zero items (e.g. an optional array like discounts with nothing extracted).
   */
  itemSchema?: Array<{ key: string; label: string; type: string }>;
}

export interface ExtractedRecord {
  id: string;
  document_id: string;
  schema_version: string;
  fields: FieldValue[];
  overall_confidence: number | null;
  party_name: string | null;
  reference_id: string | null;
  amount: number | null;
  amount_frequency: AmountFrequency | null;
  key_date: string | null; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface CreateExtractedRecordParams {
  documentId: string;
  schemaVersion: string;
  fields: FieldValue[];
  overallConfidence?: number;
  partyName?: string;
  referenceId?: string;
  amount?: number;
  amountFrequency?: AmountFrequency;
  keyDate?: string; // ISO date string or Date
}

/**
 * Create or update an extracted record for a document
 * (UPSERT - one record per document)
 */
export async function createExtractedRecord(
  params: CreateExtractedRecordParams
): Promise<ExtractedRecord> {
  const result = await query<ExtractedRecord>(
    `
    INSERT INTO extracted_records (
      document_id,
      schema_version,
      fields,
      overall_confidence,
      party_name,
      reference_id,
      amount,
      amount_frequency,
      key_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (document_id) 
    DO UPDATE SET
      schema_version = EXCLUDED.schema_version,
      fields = EXCLUDED.fields,
      overall_confidence = EXCLUDED.overall_confidence,
      party_name = EXCLUDED.party_name,
      reference_id = EXCLUDED.reference_id,
      amount = EXCLUDED.amount,
      amount_frequency = EXCLUDED.amount_frequency,
      key_date = EXCLUDED.key_date,
      updated_at = NOW()
    RETURNING *
    `,
    [
      params.documentId,
      params.schemaVersion,
      JSON.stringify(params.fields),
      params.overallConfidence ?? null,
      params.partyName ?? null,
      params.referenceId ?? null,
      params.amount ?? null,
      params.amountFrequency ?? null,
      params.keyDate ?? null,
    ]
  );

  return result.rows[0];
}

export interface UpdateExtractedRecordFieldsParams {
  documentId: string;
  fields: FieldValue[];
  partyName?: string | null;
  referenceId?: string | null;
  amount?: number | null;
  amountFrequency?: AmountFrequency | null;
  keyDate?: string | null;
}

/**
 * M2-T5c: overwrite fields (and re-derived denormalized columns) after a user
 * correction. Callers recompute denormalized_columns via document-types
 * registry.mapDenormalized() before calling this — kept generic here too.
 */
export async function updateExtractedRecordFields(
  params: UpdateExtractedRecordFieldsParams
): Promise<ExtractedRecord> {
  const result = await query<ExtractedRecord>(
    `
    UPDATE extracted_records SET
      fields = $2,
      party_name = $3,
      reference_id = $4,
      amount = $5,
      amount_frequency = $6,
      key_date = $7,
      updated_at = NOW()
    WHERE document_id = $1
    RETURNING *
    `,
    [
      params.documentId,
      JSON.stringify(params.fields),
      params.partyName ?? null,
      params.referenceId ?? null,
      params.amount ?? null,
      params.amountFrequency ?? null,
      params.keyDate ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * Get extracted record by document ID
 */
export async function getExtractedRecordByDocumentId(
  documentId: string
): Promise<ExtractedRecord | null> {
  const result = await query<ExtractedRecord>(
    `
    SELECT * FROM extracted_records
    WHERE document_id = $1
    `,
    [documentId]
  );

  return result.rows[0] || null;
}

/**
 * Get extracted records for multiple documents
 */
export async function getExtractedRecordsByDocumentIds(
  documentIds: string[]
): Promise<Map<string, ExtractedRecord>> {
  if (documentIds.length === 0) {
    return new Map();
  }

  const result = await query<ExtractedRecord>(
    `
    SELECT * FROM extracted_records
    WHERE document_id = ANY($1)
    `,
    [documentIds]
  );

  const recordsMap = new Map<string, ExtractedRecord>();
  result.rows.forEach((record) => {
    recordsMap.set(record.document_id, record);
  });

  return recordsMap;
}

/**
 * Delete extracted record by document ID
 */
export async function deleteExtractedRecord(
  documentId: string
): Promise<void> {
  await query(
    `
    DELETE FROM extracted_records
    WHERE document_id = $1
    `,
    [documentId]
  );
}
