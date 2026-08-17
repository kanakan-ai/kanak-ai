import { describe, test, expect } from 'vitest';
import { mockParseProvider } from '../mock-provider.js';
import { getDocumentTypeModule, GENERIC_SCHEMA_VERSION } from '../../document-types/registry.js';

describe('mockParseProvider', () => {
  test('has a stable provider id', () => {
    expect(mockParseProvider.id).toBe('mock');
  });

  test('returns a value for every field in the field spec', async () => {
    const module = getDocumentTypeModule('auto_policy')!;
    const output = await mockParseProvider.parse({
      documentType: 'auto_policy',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });

    expect(output.fields).toHaveLength(module.schema.fields.length);
    for (const field of output.fields) {
      expect(field.value).not.toBeNull();
      expect(field.value).not.toBe('');
    }
  });

  test('never leaves a required field null (so a straightforward mock run does not spuriously need review)', async () => {
    for (const module of [getDocumentTypeModule('receipt')!, getDocumentTypeModule('long_term_care')!]) {
      const output = await mockParseProvider.parse({
        documentType: module.documentType,
        schemaVersion: module.schema.schema_version,
        fieldSpec: module.schema.fields,
        fileBuffer: Buffer.from('irrelevant'),
        contentType: 'application/pdf',
      });
      const requiredKeys = module.schema.fields.filter((f) => f.required).map((f) => f.key);
      for (const key of requiredKeys) {
        const field = output.fields.find((f) => f.key === key);
        expect(field?.value).not.toBeNull();
      }
    }
  });

  test('produces a denormalized mapping consistent with the schema', async () => {
    const module = getDocumentTypeModule('home_policy')!;
    const output = await mockParseProvider.parse({
      documentType: 'home_policy',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });

    const carrierField = output.fields.find((f) => f.key === 'carrier');
    expect(output.denormalized.party_name).toBe(carrierField?.value);
  });

  test('picks the first enum option for enum-typed fields (e.g. amount_frequency)', async () => {
    const module = getDocumentTypeModule('warranty')!;
    const output = await mockParseProvider.parse({
      documentType: 'warranty',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });
    const freqField = output.fields.find((f) => f.key === 'amount_frequency');
    expect(freqField?.value).toBe('one_time');
  });

  test('falls back to the generic schema version for a type with no module', async () => {
    const output = await mockParseProvider.parse({
      documentType: 'tax',
      schemaVersion: GENERIC_SCHEMA_VERSION,
      fieldSpec: [],
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });
    expect(output.schemaVersion).toBe(GENERIC_SCHEMA_VERSION);
    expect(output.fields).toEqual([]);
    expect(output.denormalized).toEqual({
      party_name: null,
      reference_id: null,
      amount: null,
      amount_frequency: null,
      key_date: null,
    });
  });

  test('overall confidence is high for a clean mock run', async () => {
    const module = getDocumentTypeModule('umbrella_policy')!;
    const output = await mockParseProvider.parse({
      documentType: 'umbrella_policy',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });
    expect(output.overallConfidence).toBeGreaterThanOrEqual(0.7);
  });

  test('required object-array fields get 2 stub items, each with every declared property set', async () => {
    const module = getDocumentTypeModule('auto_policy')!;
    const output = await mockParseProvider.parse({
      documentType: 'auto_policy',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });

    const namedInsuredsField = module.schema.fields.find((f) => f.key === 'named_insureds')!;
    expect(namedInsuredsField.type).toBe('array');
    const value = output.fields.find((f) => f.key === 'named_insureds')?.value;
    expect(Array.isArray(value)).toBe(true);
    const items = value as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);

    const properties = namedInsuredsField.type === 'array' && namedInsuredsField.items.type === 'object'
      ? namedInsuredsField.items.properties
      : [];
    for (const item of items) {
      expect(typeof item).toBe('object');
      for (const prop of properties) {
        expect(item).toHaveProperty(prop.key);
        expect(item[prop.key]).not.toBeNull();
      }
    }
  });

  test('optional object-array fields get exactly 1 stub item', async () => {
    const module = getDocumentTypeModule('auto_policy')!;
    const output = await mockParseProvider.parse({
      documentType: 'auto_policy',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });
    const value = output.fields.find((f) => f.key === 'discounts')?.value;
    expect(Array.isArray(value)).toBe(true);
    expect(value).toHaveLength(1);
  });

  test('optional scalar-array fields produce a string array with 1 item', async () => {
    const module = getDocumentTypeModule('warranty')!;
    const output = await mockParseProvider.parse({
      documentType: 'warranty',
      schemaVersion: module.schema.schema_version,
      fieldSpec: module.schema.fields,
      fileBuffer: Buffer.from('irrelevant'),
      contentType: 'application/pdf',
    });
    const value = output.fields.find((f) => f.key === 'covered_components')?.value;
    expect(Array.isArray(value)).toBe(true);
    const items = value as unknown[];
    expect(items).toHaveLength(1);
    expect(typeof items[0]).toBe('string');
  });
});
