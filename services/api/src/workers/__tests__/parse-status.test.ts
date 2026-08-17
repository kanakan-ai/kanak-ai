import { describe, test, expect } from 'vitest';
import { determineStatus, isMissingValue } from '../parse-status.js';
import type { ParseOutput } from '../../parse/types.js';
import type { SchemaField } from '../../document-types/types.js';

const REQUIRED_SCALAR: SchemaField = {
  key: 'carrier',
  label: 'Carrier',
  type: 'string',
  required: true,
  review_if_low_confidence: true,
  group: 'policy',
};

const REQUIRED_ARRAY: SchemaField = {
  key: 'vehicles',
  label: 'Vehicles',
  type: 'array',
  required: true,
  review_if_low_confidence: true,
  items: { type: 'object', properties: [] },
};

function baseOutput(fields: ParseOutput['fields']): ParseOutput {
  return {
    schemaVersion: 'auto_policy.v1',
    documentType: 'auto_policy',
    overallConfidence: 0.9,
    fields,
    denormalized: { party_name: null, reference_id: null, amount: null, amount_frequency: null, key_date: null },
    providerMeta: { providerId: 'mock' },
  };
}

describe('isMissingValue', () => {
  test('treats an empty array as missing', () => {
    expect(isMissingValue([])).toBe(true);
  });

  test('treats a populated array as present', () => {
    expect(isMissingValue(['x'])).toBe(false);
    expect(isMissingValue([{ a: 1 }])).toBe(false);
  });

  test('treats null, undefined, and empty string as missing', () => {
    expect(isMissingValue(null)).toBe(true);
    expect(isMissingValue(undefined)).toBe(true);
    expect(isMissingValue('')).toBe(true);
  });

  test('treats a non-empty scalar as present', () => {
    expect(isMissingValue('Acme')).toBe(false);
    expect(isMissingValue(0)).toBe(false);
    expect(isMissingValue(false)).toBe(false);
  });
});

describe('determineStatus', () => {
  test('flags needs_review when a required array field is empty', () => {
    const output = baseOutput([
      { key: 'carrier', value: 'Acme', confidence: 0.9, needsReview: false },
      { key: 'vehicles', value: [], confidence: 0.9, needsReview: false },
    ]);
    expect(determineStatus(output, [REQUIRED_SCALAR, REQUIRED_ARRAY])).toBe('needs_review');
  });

  test('is ready when a required array field is populated and everything else checks out', () => {
    const output = baseOutput([
      { key: 'carrier', value: 'Acme', confidence: 0.9, needsReview: false },
      { key: 'vehicles', value: [{ vin: '123' }], confidence: 0.9, needsReview: false },
    ]);
    expect(determineStatus(output, [REQUIRED_SCALAR, REQUIRED_ARRAY])).toBe('ready');
  });

  test('flags needs_review when a required scalar is missing', () => {
    const output = baseOutput([
      { key: 'carrier', value: null, confidence: 0.5, needsReview: false },
      { key: 'vehicles', value: [{ vin: '123' }], confidence: 0.9, needsReview: false },
    ]);
    expect(determineStatus(output, [REQUIRED_SCALAR, REQUIRED_ARRAY])).toBe('needs_review');
  });

  test('flags needs_review when any field is individually flagged', () => {
    const output = baseOutput([
      { key: 'carrier', value: 'Acme', confidence: 0.5, needsReview: true },
      { key: 'vehicles', value: [{ vin: '123' }], confidence: 0.9, needsReview: false },
    ]);
    expect(determineStatus(output, [REQUIRED_SCALAR, REQUIRED_ARRAY])).toBe('needs_review');
  });

  test('flags needs_review when overall confidence is below the 0.7 bar', () => {
    const output = baseOutput([
      { key: 'carrier', value: 'Acme', confidence: 0.5, needsReview: false },
      { key: 'vehicles', value: [{ vin: '123' }], confidence: 0.5, needsReview: false },
    ]);
    output.overallConfidence = 0.6;
    expect(determineStatus(output, [REQUIRED_SCALAR, REQUIRED_ARRAY])).toBe('needs_review');
  });
});
