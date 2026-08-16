import { describe, test, expect } from 'vitest';
import { validatePdfStructure, checkDocumentTypeMatch } from '../document-validation.js';

describe('validatePdfStructure', () => {
  test('accepts a buffer starting with the PDF magic bytes', () => {
    const buffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
    expect(validatePdfStructure(buffer)).toEqual({ valid: true });
  });

  test('rejects an empty buffer', () => {
    const result = validatePdfStructure(Buffer.alloc(0));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  test('rejects a buffer that does not start with %PDF-, regardless of claimed Content-Type', () => {
    const result = validatePdfStructure(Buffer.from('Not actually a PDF'));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/valid PDF/i);
  });

  test('rejects a truncated buffer shorter than the magic bytes', () => {
    const result = validatePdfStructure(Buffer.from('%PD'));
    expect(result.valid).toBe(false);
  });
});

describe('checkDocumentTypeMatch', () => {
  const homePolicyText = 'This is your Home Insurance Policy declarations page. Dwelling coverage: $300,000.';
  const receiptText = 'Thank you for your purchase. Order number: 12345. Subtotal: $49.99. Total due: $53.99.';

  test('matches when a type keyword is present', () => {
    expect(checkDocumentTypeMatch(homePolicyText, 'home_policy')).toEqual({ checked: true, matched: true });
  });

  test('does not match when the text belongs to a different type', () => {
    expect(checkDocumentTypeMatch(receiptText, 'home_policy')).toEqual({ checked: true, matched: false });
  });

  test('is case-insensitive', () => {
    expect(checkDocumentTypeMatch(homePolicyText.toUpperCase(), 'home_policy')).toEqual({ checked: true, matched: true });
  });

  test('does not check when there is too little extractable text to judge', () => {
    expect(checkDocumentTypeMatch('short', 'home_policy')).toEqual({ checked: false, matched: true });
  });

  test('does not check empty text', () => {
    expect(checkDocumentTypeMatch('', 'auto_policy')).toEqual({ checked: false, matched: true });
  });

  test('always passes for a type with no keyword list ("other")', () => {
    expect(checkDocumentTypeMatch(receiptText, 'other')).toEqual({ checked: false, matched: true });
  });
});
