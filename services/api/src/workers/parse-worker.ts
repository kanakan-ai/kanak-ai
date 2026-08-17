/**
 * Parse Worker (M2-T5a)
 * Replaces M1-T4's stub-parse-worker: real ParseProvider dispatch through the
 * document-type registry instead of hardcoded per-type fake data. The provider itself
 * is still 'mock' by default (config.parse.provider) — M2-T5b swaps in a live adapter
 * behind the same interface with no change to this file.
 */

import type { Readable } from 'stream';
import { query } from '../lib/db.js';
import { updateDocumentStatus, type DocumentType } from '../services/document.js';
import { createExtractedRecord } from '../services/extracted-record.js';
import { recordParseRun } from '../services/parse-run.js';
import { getDocumentStream } from '../services/storage.js';
import { getParseProvider } from '../parse/index.js';
import { getDocumentTypeModule, GENERIC_SCHEMA_VERSION, GENERIC_FIELD_SPEC } from '../document-types/registry.js';
import { determineStatus } from './parse-status.js';
import type { ParseField } from '../parse/types.js';
import type { SchemaField } from '../document-types/types.js';

async function bufferFromStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function toFieldValues(fields: ParseField[], fieldSpec: SchemaField[]) {
  const groupByKey = new Map(
    fieldSpec.filter((f): f is SchemaField & { group: string } => 'group' in f).map((f) => [f.key, f.group])
  );
  return fields.map((f) => ({
    key: f.key,
    label: f.label ?? f.key,
    value: f.value,
    confidence: f.confidence,
    needsReview: f.needsReview,
    source: 'document',
    group: groupByKey.get(f.key),
  }));
}

async function processDocument(documentId: string, documentType: DocumentType, storageKey: string, contentType: string) {
  console.log(`[ParseWorker] Processing document ${documentId} (${documentType})`);
  await updateDocumentStatus(documentId, 'parsing');

  const module = getDocumentTypeModule(documentType);
  const schemaVersion = module?.schema.schema_version ?? GENERIC_SCHEMA_VERSION;
  const fieldSpec: SchemaField[] = module?.schema.fields ?? GENERIC_FIELD_SPEC;

  try {
    const fileBuffer = await bufferFromStream(await getDocumentStream(storageKey));
    const provider = getParseProvider();

    const output = await provider.parse({
      documentType,
      schemaVersion,
      fieldSpec,
      fileBuffer,
      contentType,
    });

    await createExtractedRecord({
      documentId,
      schemaVersion: output.schemaVersion,
      fields: toFieldValues(output.fields, fieldSpec),
      overallConfidence: output.overallConfidence,
      partyName: output.denormalized.party_name ?? undefined,
      referenceId: output.denormalized.reference_id ?? undefined,
      amount: output.denormalized.amount ?? undefined,
      amountFrequency: (output.denormalized.amount_frequency as any) ?? undefined,
      keyDate: output.denormalized.key_date ?? undefined,
    });

    const status = determineStatus(output, fieldSpec);

    await recordParseRun({
      documentId,
      providerId: output.providerMeta?.providerId ?? provider.id,
      model: output.providerMeta?.model,
      schemaVersion: output.schemaVersion,
      overallConfidence: output.overallConfidence,
      status: status === 'ready' ? 'succeeded' : 'needs_review',
      validationResults: { required_ok: status === 'ready' },
    });

    await updateDocumentStatus(documentId, status);
    console.log(`[ParseWorker] Completed document ${documentId} → ${status}`);
  } catch (error) {
    console.error(`[ParseWorker] Error processing document ${documentId}:`, error);
    await recordParseRun({
      documentId,
      providerId: 'mock',
      schemaVersion,
      status: 'failed',
      validationResults: { error: error instanceof Error ? error.message : 'unknown error' },
    });
    await updateDocumentStatus(documentId, 'failed');
  }
}

async function pollAndProcess() {
  try {
    const result = await query<{ id: string; document_type: DocumentType; storage_key: string; content_type: string }>(
      `
      SELECT id, document_type, storage_key, content_type
      FROM documents
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
      `
    );

    if (result.rows.length > 0) {
      console.log(`[ParseWorker] Found ${result.rows.length} pending documents`);
      for (const doc of result.rows) {
        await processDocument(doc.id, doc.document_type, doc.storage_key, doc.content_type);
      }
    }
  } catch (error) {
    console.error('[ParseWorker] Error polling documents:', error);
  }
}

export function startParseWorker() {
  console.log('[ParseWorker] Starting parse worker');
  setInterval(pollAndProcess, 2000);
  pollAndProcess();
}
