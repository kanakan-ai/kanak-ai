import { describe, test, expect } from 'vitest';
import { getDocumentTypeModule, listDocumentTypeModules, mapDenormalized, enrichFieldsWithSchema, GENERIC_SCHEMA_VERSION } from '../registry.js';

const EXPECTED_TYPES = [
  'auto_policy',
  'home_policy',
  'life_insurance',
  'warranty',
  'receipt',
  'umbrella_policy',
  'landlord_policy',
  'renters_policy',
  'long_term_care',
];

describe('document-types registry', () => {
  test('has exactly the 9 spec-defined modules', () => {
    const types = listDocumentTypeModules().map((m) => m.documentType).sort();
    expect(types).toEqual([...EXPECTED_TYPES].sort());
  });

  test.each(EXPECTED_TYPES)('%s module loads a well-formed schema', (documentType) => {
    const module = getDocumentTypeModule(documentType);
    expect(module).toBeDefined();
    expect(module!.schema.document_type).toBe(documentType);
    expect(module!.schema.schema_version).toBe(`${documentType}.v1`);
    expect(module!.schema.fields.length).toBeGreaterThan(0);
    // Every field referenced in denormalized_columns must actually exist in fields[].
    const fieldKeys = new Set(module!.schema.fields.map((f) => f.key));
    for (const referencedKey of Object.values(module!.schema.denormalized_columns)) {
      if (referencedKey) expect(fieldKeys.has(referencedKey)).toBe(true);
    }
  });

  test.each(EXPECTED_TYPES)('%s module has at least one type-match keyword', (documentType) => {
    const module = getDocumentTypeModule(documentType);
    expect(module!.typeKeywords.length).toBeGreaterThan(0);
  });

  test('returns undefined for tax/other (no dedicated module)', () => {
    expect(getDocumentTypeModule('tax')).toBeUndefined();
    expect(getDocumentTypeModule('other')).toBeUndefined();
    expect(getDocumentTypeModule('unknown')).toBeUndefined();
  });

  test('GENERIC_SCHEMA_VERSION matches parse-prompts.md §4.10 convention', () => {
    expect(GENERIC_SCHEMA_VERSION).toBe('other.v0');
  });
});

describe('mapDenormalized', () => {
  test('maps auto_policy fields to denormalized columns', () => {
    const module = getDocumentTypeModule('auto_policy')!;
    const result = mapDenormalized(module.schema, {
      carrier: 'State Farm',
      policy_number: 'POL-123',
      premium_annual: 1245,
      renewal_date: '2027-01-01',
    });
    expect(result).toEqual({
      party_name: 'State Farm',
      reference_id: 'POL-123',
      amount: 1245,
      amount_frequency: null,
      key_date: '2027-01-01',
    });
  });

  test('missing field values map to null, not undefined or throw', () => {
    const module = getDocumentTypeModule('long_term_care')!;
    const result = mapDenormalized(module.schema, {});
    expect(result).toEqual({
      party_name: null,
      reference_id: null,
      amount: null,
      amount_frequency: null,
      key_date: null,
    });
  });
});

describe('enrichFieldsWithSchema', () => {
  test('repairs a field that is missing group/itemSchema entirely (e.g. corrected before this existed)', () => {
    const module = getDocumentTypeModule('auto_policy')!;
    // Mirrors real corrupted storage seen in production: a scalar-shaped correction wiped
    // out the array's group/itemSchema, leaving a bare {key, value} with nothing else.
    const staleFields = [
      { key: 'carrier', value: 'State Farm' },
      { key: 'discounts', value: [''] },
    ];
    const enriched = enrichFieldsWithSchema(staleFields, module.schema.fields);

    const carrier = enriched.find((f) => f.key === 'carrier');
    expect(carrier?.group).toBe('policy');

    const discounts = enriched.find((f) => f.key === 'discounts');
    expect(discounts?.group).toBeUndefined(); // arrays never carry group
    expect(discounts?.itemSchema).toBeDefined();
    expect(discounts?.itemSchema!.length).toBeGreaterThan(0);
    expect(discounts?.itemSchema).toContainEqual({ key: 'discount_code', label: 'Discount code', type: 'string' });
  });

  test('overwrites stale group/itemSchema rather than trusting whatever was already stored', () => {
    const module = getDocumentTypeModule('auto_policy')!;
    const staleFields = [{ key: 'carrier', value: 'State Farm', group: 'wrong-old-group' }];
    const enriched = enrichFieldsWithSchema(staleFields, module.schema.fields);
    expect(enriched[0].group).toBe('policy');
  });

  test('a scalar-array field (e.g. covered_components) gets no itemSchema — items are plain strings', () => {
    const module = getDocumentTypeModule('warranty')!;
    const staleFields = [{ key: 'covered_components', value: ['compressor'] }];
    const enriched = enrichFieldsWithSchema(staleFields, module.schema.fields);
    expect(enriched[0].itemSchema).toBeUndefined();
  });

  test('leaves a field with no matching schema entry untouched', () => {
    const module = getDocumentTypeModule('auto_policy')!;
    const staleFields = [{ key: 'no_longer_in_schema', value: 'x' }];
    const enriched = enrichFieldsWithSchema(staleFields, module.schema.fields);
    expect(enriched[0]).toEqual({ key: 'no_longer_in_schema', value: 'x' });
  });
});
