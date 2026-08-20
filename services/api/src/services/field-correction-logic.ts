/**
 * Field correction diff/apply logic (M2-T5c). Pure — no DB access — so it unit-tests
 * without a DATABASE_URL, same reasoning as workers/parse-status.ts. Array corrections
 * are whole-field replacements — the client always holds the current array from the
 * last GET, so add/edit/remove of an item all collapse into "send back the new array
 * for this key," same {key, value} shape as a scalar correction. See
 * document-type-modules.md's field-shape convention.
 */

import type { FieldValue, FieldScalarValue, FieldArrayItemValue } from './extracted-record.js';
import { isArrayField, type SchemaField } from '../document-types/types.js';

export interface FieldCorrectionInput {
  key: string;
  value: FieldScalarValue | FieldArrayItemValue[];
}

export interface ApplyCorrectionsResult {
  updatedFields: FieldValue[];
  /** Corrections whose new value actually differs from the stored value — the only ones worth an audit row. */
  changed: Array<{ key: string; previousValue: unknown; previousConfidence: number | null }>;
  /** Keys in the request that don't exist on this document type's schema. */
  unknownKeys: string[];
  /** Keys where the request's array-vs-scalar shape doesn't match the schema (e.g. array value for a scalar field). */
  malformedKeys: string[];
}

function isScalarValue(value: unknown): value is FieldScalarValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Applies a batch of field corrections to the current fields array. Unknown/malformed
 * keys are reported, not thrown; the route decides whether that's a 400.
 */
export function applyCorrections(
  currentFields: FieldValue[],
  corrections: FieldCorrectionInput[],
  fieldSpec: SchemaField[]
): ApplyCorrectionsResult {
  const specByKey = new Map(fieldSpec.map((f) => [f.key, f]));
  const fieldsByKey = new Map(currentFields.map((f) => [f.key, f]));
  const unknownKeys: string[] = [];
  const malformedKeys: string[] = [];
  const changed: ApplyCorrectionsResult['changed'] = [];

  for (const correction of corrections) {
    const spec = specByKey.get(correction.key);
    if (!spec) {
      unknownKeys.push(correction.key);
      continue;
    }

    const expectsArray = isArrayField(spec);
    const gotArray = Array.isArray(correction.value);
    if (expectsArray !== gotArray) {
      malformedKeys.push(correction.key);
      continue;
    }
    if (!expectsArray && !isScalarValue(correction.value)) {
      malformedKeys.push(correction.key);
      continue;
    }

    const existing = fieldsByKey.get(correction.key);
    const previousValue = existing?.value ?? null;
    if (valuesEqual(previousValue, correction.value)) {
      continue; // no-op correction — nothing to persist or audit
    }

    changed.push({
      key: correction.key,
      previousValue,
      previousConfidence: existing?.confidence ?? null,
    });

    fieldsByKey.set(correction.key, {
      key: correction.key,
      label: existing?.label ?? spec.label,
      value: correction.value,
      confidence: 1,
      needsReview: false,
      source: 'user',
      ...(('group' in spec && spec.group) ? { group: spec.group } : {}),
      ...(existing?.itemSchema ? { itemSchema: existing.itemSchema } : {}),
    });
  }

  return {
    updatedFields: currentFields.map((f) => fieldsByKey.get(f.key) ?? f),
    changed,
    unknownKeys,
    malformedKeys,
  };
}
