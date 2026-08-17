/**
 * ParseProvider abstraction (M2-T5a)
 * Mirrors design/parse-provider.md's ParseInput/ParseOutput contract exactly. Core pipeline
 * (the parse worker) depends only on this interface — never a vendor SDK directly, same
 * boundary rule already used for EmailProvider (M2-T1) and SmsProvider (M2-T2).
 */

import type { SchemaField } from '../document-types/types.js';

export interface ParseInput {
  documentType: string;
  schemaVersion: string;
  fieldSpec: SchemaField[];
  fileBuffer: Buffer;
  contentType: string;
}

/** Mirrors openapi.yaml FieldValue.value: scalar, or an array of scalars/flat objects (one level deep). */
export type FieldScalarValue = string | number | boolean | null;
export type FieldArrayItemValue = FieldScalarValue | Record<string, FieldScalarValue>;
export type FieldValueShape = FieldScalarValue | FieldArrayItemValue[];

export interface ParseField {
  key: string;
  value: FieldValueShape;
  confidence: number;
  needsReview: boolean;
  label?: string;
}

export interface ParseDenormalized {
  party_name: string | null;
  reference_id: string | null;
  amount: number | null;
  amount_frequency: string | null;
  key_date: string | null;
}

export interface ParseOutput {
  schemaVersion: string;
  documentType: string;
  overallConfidence: number;
  fields: ParseField[];
  denormalized: ParseDenormalized;
  /** Ops-only (parse_runs.model) — never user-facing, never product analytics. */
  providerMeta?: { providerId: string; model?: string; latencyMs?: number };
}

export interface ParseProvider {
  readonly id: string;
  parse(input: ParseInput): Promise<ParseOutput>;
}
