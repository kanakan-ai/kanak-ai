/**
 * Field correction persistence (M2-T5c) — the audit trail (field_corrections). The
 * diff/apply logic (applyCorrections) lives in field-correction-logic.ts, kept
 * dependency-free so it unit-tests without a DATABASE_URL; this file is the DB-writing
 * half.
 */

import { query } from '../lib/db.js';
import type { DocumentType } from './document.js';

export interface FieldCorrectionRecord {
  userId: string;
  documentId: string;
  extractedRecordId: string | null;
  documentType: DocumentType;
  schemaVersion: string;
  fieldKey: string;
  previousValue: unknown;
  newValue: unknown;
  previousConfidence: number | null;
  source: 'user_review' | 'user_detail_edit' | 'system_reparse';
}

export async function recordFieldCorrections(corrections: FieldCorrectionRecord[]): Promise<void> {
  for (const correction of corrections) {
    await query(
      `
      INSERT INTO field_corrections (
        user_id, document_id, extracted_record_id, document_type, schema_version,
        field_key, previous_value, new_value, previous_confidence, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        correction.userId,
        correction.documentId,
        correction.extractedRecordId,
        correction.documentType,
        correction.schemaVersion,
        correction.fieldKey,
        JSON.stringify(correction.previousValue),
        JSON.stringify(correction.newValue),
        correction.previousConfidence,
        correction.source,
      ]
    );
  }
}
