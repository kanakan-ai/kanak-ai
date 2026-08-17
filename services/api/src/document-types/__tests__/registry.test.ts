import { describe, test, expect } from 'vitest';
import { getDocumentTypeModule, listDocumentTypeModules, mapDenormalized, GENERIC_SCHEMA_VERSION } from '../registry.js';

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
