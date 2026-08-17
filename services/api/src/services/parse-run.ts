/**
 * Parse run lineage service (M2-T5a)
 * design/explainability-grounding.md §5 / schema.sql `parse_runs`: one row per parse
 * attempt, for debugging/audit — separate from the single current extracted_records row.
 */

import { query } from '../lib/db.js';

export type ParseRunStatus = 'succeeded' | 'failed' | 'needs_review';

export interface RecordParseRunParams {
  documentId: string;
  providerId: string;
  model?: string;
  schemaVersion?: string;
  overallConfidence?: number;
  status: ParseRunStatus;
  validationResults?: Record<string, unknown>;
}

export async function recordParseRun(params: RecordParseRunParams): Promise<void> {
  await query(
    `
    INSERT INTO parse_runs (
      document_id,
      provider_id,
      model,
      schema_version,
      overall_confidence,
      status,
      validation_results
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      params.documentId,
      params.providerId,
      params.model ?? null,
      params.schemaVersion ?? null,
      params.overallConfidence ?? null,
      params.status,
      JSON.stringify(params.validationResults ?? {}),
    ]
  );
}
