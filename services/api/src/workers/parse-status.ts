/**
 * document-type-modules.md "Low-confidence review": a required field with no value, or
 * overall/per-field confidence below the 0.7 bar, sends the document to needs_review
 * instead of ready. Kept dependency-free (no db.js) so it unit-tests without a DATABASE_URL.
 */
import type { ParseField, ParseOutput } from '../parse/types.js';
import type { SchemaField } from '../document-types/types.js';

export function isMissingValue(value: ParseField['value']): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === null || value === undefined || value === '';
}

/** Structural subset shared by ParseField and extracted-record.ts's FieldValue. */
interface StatusField {
  key: string;
  value: ParseField['value'];
  needsReview?: boolean;
}

function hasMissingOrFlaggedField(fields: StatusField[], fieldSpec: SchemaField[]): boolean {
  const requiredKeys = new Set(fieldSpec.filter((f) => f.required).map((f) => f.key));
  const missingRequired = fields.some((f) => requiredKeys.has(f.key) && isMissingValue(f.value));
  const flaggedField = fields.some((f) => f.needsReview);
  return missingRequired || flaggedField;
}

export function determineStatus(output: ParseOutput, fieldSpec: SchemaField[]): 'ready' | 'needs_review' {
  if (hasMissingOrFlaggedField(output.fields, fieldSpec) || output.overallConfidence < 0.7) {
    return 'needs_review';
  }
  return 'ready';
}

/**
 * M2-T5c: recompute status after a user correction. Deliberately ignores the
 * document's stored overall_confidence — that's a parse-time-only signal; once a human
 * has fixed every missing-required/flagged field, the document should graduate to
 * `ready` regardless of the original (now-stale) confidence number.
 */
export function determineStatusAfterCorrection(fields: StatusField[], fieldSpec: SchemaField[]): 'ready' | 'needs_review' {
  return hasMissingOrFlaggedField(fields, fieldSpec) ? 'needs_review' : 'ready';
}
