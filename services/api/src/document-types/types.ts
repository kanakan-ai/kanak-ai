/**
 * Document-type module shapes (M2-T5a)
 * Mirrors design/document-type-modules.md's module contract: each document type is an
 * atomic module (schema + validate + denormalize map), dispatched only through the
 * registry — core services never branch on a specific document_type value.
 *
 * Reopened for comprehensive schemas (2026-08-17): fields may now be scalar or array
 * (repeating entities — vehicles, drivers, named insureds, etc.), one level deep only.
 * See design/document-type-modules.md's "Field-shape convention: scalar, array, and
 * group" section — this is the TypeScript mirror of that convention.
 */

export type ScalarFieldType = 'string' | 'number' | 'date' | 'boolean';

/** A leaf field — either a top-level scalar, or a property inside an array item (which never carries `group`). */
interface BaseScalarField {
  key: string;
  label: string;
  type: ScalarFieldType;
  required: boolean;
  review_if_low_confidence: boolean;
  enum?: Array<string | number>;
  description?: string;
}

/** Top-level scalar field — every one MUST declare a `group` (drives the accordion review UI). */
export interface ScalarSchemaField extends BaseScalarField {
  group: string;
}

/** Array-item property — same leaf shape as a scalar field, but never grouped (belongs to its array's own section). */
export type ArrayItemField = BaseScalarField;

export type ArrayItemsSpec =
  | { type: 'string' }
  | { type: 'object'; properties: ArrayItemField[] };

/** Top-level array field (repeating entity) — never carries `group`; the array's own `label` is its section. */
export interface ArraySchemaField {
  key: string;
  label: string;
  type: 'array';
  required: boolean;
  review_if_low_confidence: boolean;
  items: ArrayItemsSpec;
  description?: string;
}

/** Discriminated on `type` — narrow with `field.type === 'array'`. */
export type SchemaField = ScalarSchemaField | ArraySchemaField;

export function isArrayField(field: SchemaField): field is ArraySchemaField {
  return field.type === 'array';
}

/** Shape of design/schemas/{type}.v1.json, copied verbatim into ./schemas/. */
export interface TypeSchema {
  schema_version: string;
  document_type: string;
  description: string;
  fields: SchemaField[];
  denormalized_columns: {
    party_name?: string;
    reference_id?: string;
    amount?: string;
    amount_frequency?: string;
    key_date?: string;
  };
}

export interface DenormalizedFields {
  party_name: string | null;
  reference_id: string | null;
  amount: number | null;
  amount_frequency: string | null;
  key_date: string | null;
}

export interface DocumentTypeModule {
  documentType: string;
  schema: TypeSchema;
  /**
   * Bare-minimum keyword list for M2-T4's upload-time type-match heuristic
   * (services/document-validation.ts). Empty for the generic tax/other fallback,
   * which has no dedicated schema per parse-prompts.md §4.10.
   */
  typeKeywords: string[];
}
