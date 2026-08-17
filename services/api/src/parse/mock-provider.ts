/**
 * Mock ParseProvider (M2-T5a) — deterministic, schema-shaped stub output.
 * design/parse-provider.md: "mock: Returns schema-shaped stub for CI / offline" and
 * "Default for local without keys: PARSE_PROVIDER=mock (deterministic fixtures)."
 *
 * Unlike M1-T4's stub-parse-worker (hardcoded per-type fake objects), this is driven
 * entirely by each type's real field schema (design/schemas/*.v1.json via the
 * document-types registry) — every field the schema declares gets a plausible,
 * correctly-typed stub value, including array (repeating-entity) fields. Real
 * extraction (reading the actual PDF) is M2-T5b; this adapter never inspects
 * input.fileBuffer.
 */

import type { ParseProvider, ParseInput, ParseOutput, ParseField, FieldValueShape, FieldArrayItemValue } from './types.js';
import type { SchemaField, ArraySchemaField, ArrayItemField } from '../document-types/types.js';
import { isArrayField } from '../document-types/types.js';
import { getDocumentTypeModule, mapDenormalized, GENERIC_SCHEMA_VERSION } from '../document-types/registry.js';

function stubScalarValueFor(field: ArrayItemField): string | number | boolean {
  if (field.enum && field.enum.length > 0) {
    return field.enum[0];
  }
  switch (field.type) {
    case 'number':
      return 100;
    case 'boolean':
      return true;
    case 'date': {
      const future = new Date();
      future.setDate(future.getDate() + 90);
      return future.toISOString().slice(0, 10);
    }
    case 'string':
    default:
      return `Sample ${field.label}`;
  }
}

function stubItemFor(properties: ArrayItemField[]): Record<string, string | number | boolean> {
  return Object.fromEntries(properties.map((p) => [p.key, stubScalarValueFor(p)]));
}

/**
 * Required arrays get 2 items (shows the accordion UI handling a real "list," e.g. two
 * named insureds); optional arrays get 1 — proportionate mock data, not maximal per array.
 */
function stubArrayValueFor(field: ArraySchemaField): FieldArrayItemValue[] {
  const itemCount = field.required ? 2 : 1;
  const items = field.items; // local const so narrowing survives the Array.from callback closures below
  if (items.type === 'string') {
    return Array.from({ length: itemCount }, (_, i) => `Sample ${field.label} ${i + 1}`);
  }
  return Array.from({ length: itemCount }, () => stubItemFor(items.properties));
}

function stubValueFor(field: SchemaField): FieldValueShape {
  return isArrayField(field) ? stubArrayValueFor(field) : stubScalarValueFor(field);
}

export const mockParseProvider: ParseProvider = {
  id: 'mock',
  async parse(input: ParseInput): Promise<ParseOutput> {
    const fields: ParseField[] = input.fieldSpec.map((field) => ({
      key: field.key,
      label: field.label,
      value: stubValueFor(field),
      confidence: 0.9,
      needsReview: false,
    }));

    // Denormalization only ever reads scalar field values (validated at schema-authoring
    // time — denormalized_columns never references an array field), so array values just
    // sit unused here rather than needing to be filtered out first.
    const fieldValues = Object.fromEntries(fields.map((f) => [f.key, f.value]));
    const module = getDocumentTypeModule(input.documentType);
    const denormalized = module
      ? mapDenormalized(module.schema, fieldValues)
      : { party_name: null, reference_id: null, amount: null, amount_frequency: null, key_date: null };

    return {
      schemaVersion: module?.schema.schema_version ?? GENERIC_SCHEMA_VERSION,
      documentType: input.documentType,
      overallConfidence: fields.length > 0 ? 0.9 : 0,
      fields,
      denormalized,
      providerMeta: { providerId: 'mock' },
    };
  },
};
