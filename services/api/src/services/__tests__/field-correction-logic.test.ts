import { describe, test, expect } from 'vitest';
import { applyCorrections } from '../field-correction-logic.js';
import type { FieldValue } from '../extracted-record.js';
import type { SchemaField } from '../../document-types/types.js';

const CARRIER_FIELD: SchemaField = {
  key: 'carrier',
  label: 'Carrier',
  type: 'string',
  required: true,
  review_if_low_confidence: true,
  group: 'policy',
};

const VEHICLES_FIELD: SchemaField = {
  key: 'vehicles',
  label: 'Vehicles',
  type: 'array',
  required: true,
  review_if_low_confidence: true,
  items: {
    type: 'object',
    properties: [
      { key: 'vin', label: 'VIN', type: 'string', required: false, review_if_low_confidence: true },
      { key: 'year', label: 'Year', type: 'number', required: true, review_if_low_confidence: false },
    ],
  },
};

const FIELD_SPEC = [CARRIER_FIELD, VEHICLES_FIELD];

const CURRENT_FIELDS: FieldValue[] = [
  { key: 'carrier', label: 'Carrier', value: 'Acme Insurance', confidence: 0.5, needsReview: true, source: 'document', group: 'policy' },
  {
    key: 'vehicles',
    label: 'Vehicles',
    value: [
      { vin: '1HGCM82633A004352', year: 2020 },
      { vin: '2HGCM82633A004353', year: 2021 },
    ],
    confidence: 0.9,
    needsReview: false,
    source: 'document',
  },
];

describe('applyCorrections', () => {
  test('corrects a scalar field: updates value, clears needsReview, sets confidence 1 and source user', () => {
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'carrier', value: 'State Farm' }], FIELD_SPEC);
    expect(result.changed).toEqual([{ key: 'carrier', previousValue: 'Acme Insurance', previousConfidence: 0.5 }]);
    const carrier = result.updatedFields.find((f) => f.key === 'carrier');
    expect(carrier?.value).toBe('State Farm');
    expect(carrier?.needsReview).toBe(false);
    expect(carrier?.confidence).toBe(1);
    expect(carrier?.source).toBe('user');
  });

  test('edits one item inside an array field by sending back the whole array', () => {
    const newVehicles = [
      { vin: 'CORRECTED-VIN', year: 2020 },
      { vin: '2HGCM82633A004353', year: 2021 },
    ];
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'vehicles', value: newVehicles }], FIELD_SPEC);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].key).toBe('vehicles');
    const vehicles = result.updatedFields.find((f) => f.key === 'vehicles');
    expect(vehicles?.value).toEqual(newVehicles);
  });

  test('adding an item is just a longer array in the same correction', () => {
    const newVehicles = [
      { vin: '1HGCM82633A004352', year: 2020 },
      { vin: '2HGCM82633A004353', year: 2021 },
      { vin: 'NEW-VIN', year: 2022 },
    ];
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'vehicles', value: newVehicles }], FIELD_SPEC);
    const vehicles = result.updatedFields.find((f) => f.key === 'vehicles');
    expect((vehicles?.value as unknown[]).length).toBe(3);
  });

  test('removing an item is just a shorter array in the same correction', () => {
    const newVehicles = [{ vin: '1HGCM82633A004352', year: 2020 }];
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'vehicles', value: newVehicles }], FIELD_SPEC);
    const vehicles = result.updatedFields.find((f) => f.key === 'vehicles');
    expect((vehicles?.value as unknown[]).length).toBe(1);
  });

  test('a no-op correction (identical value) is not reported as changed and leaves the field untouched', () => {
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'carrier', value: 'Acme Insurance' }], FIELD_SPEC);
    expect(result.changed).toEqual([]);
    const carrier = result.updatedFields.find((f) => f.key === 'carrier');
    expect(carrier?.needsReview).toBe(true); // untouched, not force-cleared
  });

  test('reports an unknown field key without applying it', () => {
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'not_a_real_field', value: 'x' }], FIELD_SPEC);
    expect(result.unknownKeys).toEqual(['not_a_real_field']);
    expect(result.changed).toEqual([]);
  });

  test('rejects an array value for a scalar field as malformed', () => {
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'carrier', value: ['not', 'a', 'scalar'] as any }], FIELD_SPEC);
    expect(result.malformedKeys).toEqual(['carrier']);
    expect(result.changed).toEqual([]);
  });

  test('rejects a scalar value for an array field as malformed', () => {
    const result = applyCorrections(CURRENT_FIELDS, [{ key: 'vehicles', value: 'not an array' as any }], FIELD_SPEC);
    expect(result.malformedKeys).toEqual(['vehicles']);
    expect(result.changed).toEqual([]);
  });

  test('applies a mixed batch: one valid correction alongside one unknown key', () => {
    const result = applyCorrections(
      CURRENT_FIELDS,
      [
        { key: 'carrier', value: 'State Farm' },
        { key: 'bogus_key', value: 'ignored' },
      ],
      FIELD_SPEC
    );
    expect(result.unknownKeys).toEqual(['bogus_key']);
    expect(result.changed).toHaveLength(1);
    expect(result.updatedFields.find((f) => f.key === 'carrier')?.value).toBe('State Farm');
  });
});
