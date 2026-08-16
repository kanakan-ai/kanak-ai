import { describe, test, expect } from 'vitest';
import { validateEmailFormat } from '../email-validation.js';

describe('validateEmailFormat', () => {
  test('accepts a well-formed email', () => {
    expect(validateEmailFormat('somujay@hotmail.com')).toEqual({ valid: true });
  });

  test.each([undefined, null, '', 'not-an-email', 'missing-at.com', '@nodomain', 'no-tld@example', 'spaces in@example.com'])(
    'rejects malformed input: %s',
    (input) => {
      const result = validateEmailFormat(input as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid email address');
    }
  );

  test('catches a common domain typo and suggests the fix', () => {
    const result = validateEmailFormat('somujay@hotmail.con');
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe('somujay@hotmail.com');
    expect(result.reason).toContain('somujay@hotmail.com');
  });

  test.each([
    ['user@gmail.con', 'user@gmail.com'],
    ['user@gmail.cmo', 'user@gmail.com'],
    ['user@yahoo.con', 'user@yahoo.com'],
    ['user@outlook.cmo', 'user@outlook.com'],
    ['user@icloud.con', 'user@icloud.com'],
  ])('suggests a fix for %s -> %s', (input, expected) => {
    const result = validateEmailFormat(input);
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe(expected);
  });

  test('is case-insensitive when matching known typo domains', () => {
    const result = validateEmailFormat('Someone@Hotmail.CON');
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe('Someone@hotmail.com');
  });

  test('does not flag a correct domain that merely resembles a typo entry', () => {
    expect(validateEmailFormat('user@hotmail.com')).toEqual({ valid: true });
  });
});
