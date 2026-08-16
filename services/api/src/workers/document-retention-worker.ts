/**
 * Document Retention Worker (M2-T4 follow-up)
 * Removes 'needs_review'/'failed' documents that have sat unresolved past
 * config.documents.retentionDays — reclaims storage for uploads the user
 * never acted on (e.g. a confirmed type-mismatch override left unreviewed).
 */

import { config } from '../config.js';
import { listStaleUnresolvedDocuments, deleteDocumentById } from '../services/document.js';
import { deleteDocument as deleteStorageObject } from '../services/storage.js';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly — the retention window is measured in days

async function sweepStaleDocuments() {
  try {
    const stale = await listStaleUnresolvedDocuments(config.documents.retentionDays);
    if (stale.length === 0) return;

    console.log(`[DocumentRetentionWorker] Removing ${stale.length} document(s) past the ${config.documents.retentionDays}-day retention window`);
    for (const document of stale) {
      try {
        await deleteStorageObject(document.storage_key);
        await deleteDocumentById(document.id);
      } catch (error) {
        console.error(`[DocumentRetentionWorker] Failed to remove document ${document.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[DocumentRetentionWorker] Error sweeping stale documents:', error);
  }
}

export function startDocumentRetentionWorker() {
  console.log(`[DocumentRetentionWorker] Starting (retention: ${config.documents.retentionDays} days, poll: hourly)`);
  setInterval(sweepStaleDocuments, POLL_INTERVAL_MS);
  sweepStaleDocuments();
}
