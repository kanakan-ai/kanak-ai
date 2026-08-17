/**
 * Document-type module registry (M2-T5a)
 * design/document-type-modules.md: "Adding a new type ... should mean adding a module +
 * registration — not editing shared parse core conditionals for every type." Adding a type
 * here means: drop the schema JSON into ./schemas/, add one keyword-list entry below.
 *
 * Schema JSON files are copied verbatim from kanak-ai-specs/design/schemas/ — same pattern
 * as database/schema.sql mirroring kanak-ai-specs/design/data/schema.sql. Read via fs
 * (not a JS import) so this never depends on Node's ESM JSON-import-attribute support.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DocumentTypeModule, TypeSchema, DenormalizedFields } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.join(__dirname, 'schemas');

function loadSchema(fileName: string): TypeSchema {
  const raw = fs.readFileSync(path.join(SCHEMAS_DIR, fileName), 'utf8');
  return JSON.parse(raw) as TypeSchema;
}

const MODULES: Record<string, DocumentTypeModule> = {
  auto_policy: {
    documentType: 'auto_policy',
    schema: loadSchema('auto_policy.v1.json'),
    typeKeywords: ['auto insurance', 'automobile', 'vehicle', ' vin ', 'motor vehicle', 'collision coverage'],
  },
  home_policy: {
    documentType: 'home_policy',
    schema: loadSchema('home_policy.v1.json'),
    typeKeywords: ['home insurance', 'homeowners', 'homeowner', 'dwelling', 'property insurance'],
  },
  life_insurance: {
    documentType: 'life_insurance',
    schema: loadSchema('life_insurance.v1.json'),
    typeKeywords: ['life insurance', 'beneficiary', 'death benefit', 'face amount', 'term life', 'whole life'],
  },
  warranty: {
    documentType: 'warranty',
    schema: loadSchema('warranty.v1.json'),
    typeKeywords: ['warranty', 'service contract', 'extended warranty'],
  },
  receipt: {
    documentType: 'receipt',
    schema: loadSchema('receipt.v1.json'),
    typeKeywords: ['receipt', 'subtotal', 'total due', 'purchase date', 'order number'],
  },
  umbrella_policy: {
    documentType: 'umbrella_policy',
    schema: loadSchema('umbrella_policy.v1.json'),
    typeKeywords: ['umbrella', 'excess liability', 'personal umbrella'],
  },
  landlord_policy: {
    documentType: 'landlord_policy',
    schema: loadSchema('landlord_policy.v1.json'),
    // 'dwelling' alone is deliberately excluded — it's already a home_policy keyword and,
    // per document-type-modules.md, cross-type ambiguity is fine for this weak heuristic
    // (both may "pass" for the same doc; it never blocks, only warns). 'fair rental value'
    // and 'dwelling fire'/'dwelling special' were added after a real DP-3-style policy
    // (American Modern "Dwelling Special" form) used those terms instead of 'landlord' or
    // 'loss of rents' and incorrectly failed this check.
    typeKeywords: [
      'landlord',
      'rental dwelling',
      'loss of rents',
      'fair rental value',
      'dp-3',
      'dp-2',
      'dp-1',
      'dwelling fire',
      'dwelling special',
      'non-owner occupied',
      'rental property',
    ],
  },
  renters_policy: {
    documentType: 'renters_policy',
    schema: loadSchema('renters_policy.v1.json'),
    typeKeywords: ['renters insurance', 'tenant', 'ho-4', 'loss of use'],
  },
  long_term_care: {
    documentType: 'long_term_care',
    schema: loadSchema('long_term_care.v1.json'),
    typeKeywords: ['long-term care', 'long term care', 'ltc', 'daily benefit', 'elimination period'],
  },
};

/** tax/other share this generic fallback — no dedicated module, per parse-prompts.md §4.10. */
export const GENERIC_SCHEMA_VERSION = 'other.v0';

/**
 * document-type-modules.md §4.10 / parse-prompts.md: tax/other have no fixed schema, but
 * still "extract any clearly labeled: party_name, reference_id, amounts, dates, and a
 * short title. Return sparse fields[]." Neither field is required — a generic document
 * with nothing extractable is still a normal successful parse, not a review flag.
 */
export const GENERIC_FIELD_SPEC: TypeSchema['fields'] = [
  { key: 'title', label: 'Title', type: 'string', required: false, review_if_low_confidence: false, group: 'general' },
  { key: 'date', label: 'Date', type: 'date', required: false, review_if_low_confidence: false, group: 'general' },
];

export function getDocumentTypeModule(documentType: string): DocumentTypeModule | undefined {
  return MODULES[documentType];
}

export function listDocumentTypeModules(): DocumentTypeModule[] {
  return Object.values(MODULES);
}

/**
 * Generic — derives denormalized_columns purely from the schema's own mapping plus the
 * extracted field values. No per-type code: every module works through this same function.
 */
export function mapDenormalized(schema: TypeSchema, fieldValues: Record<string, unknown>): DenormalizedFields {
  const cols = schema.denormalized_columns;
  const get = (fieldKey?: string): unknown => (fieldKey ? fieldValues[fieldKey] ?? null : null);
  return {
    party_name: (get(cols.party_name) as string | null) ?? null,
    reference_id: (get(cols.reference_id) as string | null) ?? null,
    amount: (get(cols.amount) as number | null) ?? null,
    amount_frequency: (get(cols.amount_frequency) as string | null) ?? null,
    key_date: (get(cols.key_date) as string | null) ?? null,
  };
}
