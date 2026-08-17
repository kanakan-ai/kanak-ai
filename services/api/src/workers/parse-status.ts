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

export function determineStatus(output: ParseOutput, fieldSpec: SchemaField[]): 'ready' | 'needs_review' {
  const requiredKeys = new Set(fieldSpec.filter((f) => f.required).map((f) => f.key));
  const missingRequired = output.fields.some((f) => requiredKeys.has(f.key) && isMissingValue(f.value));
  const flaggedField = output.fields.some((f) => f.needsReview);
  if (missingRequired || flaggedField || output.overallConfidence < 0.7) {
    return 'needs_review';
  }
  return 'ready';
}
