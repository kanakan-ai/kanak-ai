/**
 * PDF/type validation (M2-T4)
 * design/m2-capabilities.md §3 "PDF validation of selected type":
 *   "MIME / magic bytes = PDF ... Not empty / under size limit ...
 *    Optional: text/layout heuristics or model 'type check' pass"
 */

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { DocumentType } from './document.js';

const PDF_MAGIC_BYTES = Buffer.from('%PDF-');

export interface StructuralValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePdfStructure(buffer: Buffer): StructuralValidationResult {
  if (buffer.length === 0) {
    return { valid: false, reason: 'The uploaded file is empty.' };
  }
  if (!buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    return { valid: false, reason: 'The uploaded file does not appear to be a valid PDF.' };
  }
  return { valid: true };
}

/**
 * Bare-minimum "does this look like the selected type" heuristic: a handful of
 * distinctive keywords per type, matched against extracted text. Deliberately
 * weak and lenient (any single keyword hit counts as a match) — the real
 * semantic check is document-type-modules.md's per-type registry.validate()
 * (M2-T5a), which will have the actual parse model available. This exists
 * only to catch obvious, unambiguous mismatches (e.g. a receipt uploaded as
 * a life insurance policy) without waiting on that registry, and without
 * ever hard-rejecting an upload — see checkDocumentTypeMatch below.
 */
const TYPE_KEYWORDS: Partial<Record<DocumentType, string[]>> = {
  auto_policy: ['auto insurance', 'automobile', 'vehicle', ' vin ', 'motor vehicle', 'collision coverage'],
  home_policy: ['home insurance', 'homeowners', 'homeowner', 'dwelling', 'property insurance'],
  life_insurance: ['life insurance', 'beneficiary', 'death benefit', 'face amount', 'term life', 'whole life'],
  warranty: ['warranty', 'service contract', 'extended warranty'],
  receipt: ['receipt', 'subtotal', 'total due', 'purchase date', 'order number'],
  tax: ['internal revenue', 'form 1040', 'w-2', 'tax return', 'irs'],
};

/** Below this much extracted text, there isn't enough signal to judge either way (e.g. a scanned/image-only page). */
const MIN_TEXT_LENGTH_TO_JUDGE = 30;

export interface TypeMatchResult {
  /** false = not enough signal to judge (short/no extractable text, or a type with no keyword list, e.g. "other") — always treated as a pass, never a rejection. */
  checked: boolean;
  matched: boolean;
}

export function checkDocumentTypeMatch(text: string, documentType: DocumentType): TypeMatchResult {
  const keywords = TYPE_KEYWORDS[documentType];
  if (!keywords || text.trim().length < MIN_TEXT_LENGTH_TO_JUDGE) {
    return { checked: false, matched: true };
  }
  const lower = text.toLowerCase();
  return { checked: true, matched: keywords.some((keyword) => lower.includes(keyword)) };
}

/**
 * Best-effort text extraction via pdfjs-dist. Throws on malformed/encrypted/
 * image-only PDFs — callers should treat a thrown error the same as "no
 * text found" (undetermined, not a validation failure); the structural
 * check above is what guarantees the upload is a real PDF.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  try {
    let text = '';
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
    }
    return text;
  } finally {
    await doc.destroy();
  }
}
