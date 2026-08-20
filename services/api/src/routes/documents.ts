/**
 * Document routes
 * M1-T3: PDF upload and vault endpoints
 * M1-T4: Enhanced with extracted records
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';
import { authenticateRequest } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import * as documentService from '../services/document.js';
import * as storageService from '../services/storage.js';
import * as extractedRecordService from '../services/extracted-record.js';
import { recordEvent } from '../services/analytics.js';
import { validatePdfStructure, extractPdfText, checkDocumentTypeMatch } from '../services/document-validation.js';
import type { TypeMatchResult } from '../services/document-validation.js';
import { applyCorrections } from '../services/field-correction-logic.js';
import type { FieldCorrectionInput } from '../services/field-correction-logic.js';
import { recordFieldCorrections } from '../services/field-correction.js';
import { determineStatusAfterCorrection } from '../workers/parse-status.js';
import { getDocumentTypeModule, mapDenormalized, enrichFieldsWithSchema, GENERIC_SCHEMA_VERSION, GENERIC_FIELD_SPEC } from '../document-types/registry.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_DOCUMENT_TYPES = [
  'auto_policy',
  'home_policy',
  'life_insurance',
  'warranty',
  'tax',
  'receipt',
  'other',
  'umbrella_policy',
  'landlord_policy',
  'renters_policy',
  'long_term_care',
] as const;

/**
 * `group`/`itemSchema` are schema metadata, not extracted data — always re-derive them from
 * the *current* schema before a record leaves the API, regardless of what's stored (see
 * enrichFieldsWithSchema). Every response that includes an extracted_record goes through this.
 */
function withEnrichedRecord<T extends { extracted_record: extractedRecordService.ExtractedRecord | null }>(
  document: T,
  documentType: string
): T {
  if (!document.extracted_record) return document;
  const fieldSpec = getDocumentTypeModule(documentType)?.schema.fields ?? GENERIC_FIELD_SPEC;
  return {
    ...document,
    extracted_record: {
      ...document.extracted_record,
      fields: enrichFieldsWithSchema(document.extracted_record.fields, fieldSpec),
    },
  };
}

export default async function documentRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/documents
   * Upload a PDF document
   */
  fastify.post(
    '/documents',
    {
      onRequest: [authenticateRequest],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authReq = request as AuthenticatedRequest;
      
      try {
        // Get multipart data
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'No file uploaded',
          });
        }

        // Validate file type
        if (data.mimetype !== 'application/pdf') {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Only PDF files are supported',
          });
        }

        // Read file into buffer to check size
        const chunks: Buffer[] = [];
        let totalSize = 0;

        for await (const chunk of data.file) {
          totalSize += chunk.length;

          if (totalSize > MAX_FILE_SIZE) {
            return reply.code(413).send({
              error: 'Payload Too Large',
              message: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            });
          }

          chunks.push(chunk);
        }

        const fileBuffer = Buffer.concat(chunks);

        // Non-file fields (documentType, source, confirmTypeOverride) are read only *after*
        // the file stream is fully drained. @fastify/multipart's request.file() resolves as
        // soon as the file part's header is seen — fields that appear later in the multipart
        // body (as ours do; the web client appends `file` before `documentType`) aren't
        // guaranteed to be parsed into data.fields yet at that point. For a small test fixture
        // sent in one shot this race is invisible; for a real browser upload of an
        // actual-sized PDF it reliably read documentType as undefined. Reading fields here,
        // after the stream is exhausted, is always safe regardless of field order.
        const documentType = (data.fields.documentType as any)?.value;
        const source = ((data.fields.source as any)?.value || 'upload') as documentService.DocumentSource;
        // Set after the user has already seen a type-mismatch warning and chosen to proceed anyway
        // (see the requiresConfirmation branch below) — resubmission of the same upload.
        const confirmTypeOverride = (data.fields.confirmTypeOverride as any)?.value === 'true';

        if (!documentType) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'documentType is required',
          });
        }

        if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: `Invalid documentType. Must be one of: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`,
          });
        }

        // M2-T4: structural check (magic bytes) — the Content-Type/mimetype check above
        // is client-supplied and easily spoofed; this confirms the bytes are actually a PDF.
        const structuralCheck = validatePdfStructure(fileBuffer);
        if (!structuralCheck.valid) {
          await recordEvent({
            userId: authReq.user!.id,
            event: 'document_validation_failed',
            properties: { document_type: documentType },
          });
          return reply.code(400).send({
            error: 'Bad Request',
            message: structuralCheck.reason,
          });
        }

        // M2-T4: bare-minimum "does this look like the selected type" keyword check.
        // Best-effort only — extraction failures (encrypted/image-only/malformed-past-the-
        // magic-bytes PDFs) are treated as undetermined, never as a mismatch.
        let typeMatch: TypeMatchResult = { checked: false, matched: true };
        try {
          const text = await extractPdfText(fileBuffer);
          typeMatch = checkDocumentTypeMatch(text, documentType as documentService.DocumentType);
        } catch (extractError) {
          request.log.info({ err: extractError }, 'Could not extract PDF text for type-match check; skipping');
        }

        // Block *before* storage/DB writes on an unconfirmed mismatch — avoids paying storage
        // cost for the common case (wrong type picked by mistake) and keeps the user on the
        // upload screen making an informed choice, rather than discovering a flagged item
        // later in the vault. requiresConfirmation lets the client show a confirm prompt
        // instead of a plain error; resubmitting with confirmTypeOverride=true skips this check.
        // (Not yet reflected in openapi.yaml's Error schema — additive field, existing BadRequest
        // consumers unaffected.)
        if (typeMatch.checked && !typeMatch.matched && !confirmTypeOverride) {
          await recordEvent({
            userId: authReq.user!.id,
            event: 'document_validation_failed',
            properties: { document_type: documentType },
          });
          const typeLabel = documentType.replace(/_/g, ' ');
          return reply.code(400).send({
            error: 'Needs Confirmation',
            message: `This doesn't look like a ${typeLabel}. Upload anyway, or choose a different type?`,
            requiresConfirmation: true,
            documentType,
          });
        }

        // Reaching here means either the type matched (or was inconclusive), or the user
        // explicitly confirmed an override on a real mismatch. The override case still isn't
        // "clean" — it stays needs_review so it's never picked up by the parse worker (avoids
        // showing fabricated/unrelated stub fields for content the system already flagged) and
        // stays visibly flagged until a future review flow (M2-T5c) resolves it, or the
        // retention worker removes it if left unresolved (config.documents.retentionDays).
        const wasConfirmedOverride = typeMatch.checked && !typeMatch.matched && confirmTypeOverride;

        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Generate storage key
        const fileExtension = data.filename.split('.').pop() || 'pdf';
        const documentId = crypto.randomUUID();
        const storageKey = `${authReq.user!.id}/${documentId}.${fileExtension}`;

        // Upload to MinIO
        await storageService.uploadDocument(
          storageKey,
          fileBuffer,
          totalSize,
          data.mimetype
        );

        const document = await documentService.createDocument({
          userId: authReq.user!.id,
          documentType: documentType as documentService.DocumentType,
          source,
          storageKey,
          contentType: data.mimetype,
          byteSize: totalSize,
          checksum: fileHash,
          status: wasConfirmedOverride ? 'needs_review' : 'pending',
        });

        await recordEvent({
          userId: authReq.user!.id,
          event: wasConfirmedOverride ? 'document_validation_failed' : 'document_validation_passed',
          properties: { document_type: documentType },
        });

        await recordEvent({
          userId: authReq.user!.id,
          event: 'document_upload_accepted',
          properties: { document_type: documentType },
        });

        const typeLabel = documentType.replace(/_/g, ' ');
        return reply.code(202).send({
          documentId: document.id,
          status: document.status,
          message: wasConfirmedOverride
            ? `Uploaded, but flagged for review since it doesn't look like a ${typeLabel} — take a look when you can. It'll be automatically removed in ${config.documents.retentionDays} days if left unresolved.`
            : 'Document uploaded and queued for processing',
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to upload document');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to upload document',
        });
      }
    }
  );

  /**
   * GET /v1/documents
   * List user's documents
   * M1-T4: Include extracted records for vault display
   */
  fastify.get(
    '/documents',
    {
      onRequest: [authenticateRequest],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authReq = request as AuthenticatedRequest;
      
      try {
        const { status, limit } = request.query as {
          status?: documentService.DocumentStatus;
          limit?: string;
        };

        const parsedLimit = limit ? parseInt(limit, 10) : 50;

        if (parsedLimit < 1 || parsedLimit > 100) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'limit must be between 1 and 100',
          });
        }

        const documents = await documentService.listDocuments(
          authReq.user!.id,
          status,
          parsedLimit
        );

        // Get extracted records for all documents
        const documentIds = documents.map((doc) => doc.id);
        const extractedRecordsMap = await extractedRecordService.getExtractedRecordsByDocumentIds(documentIds);

        // Combine documents with their extracted records
        const documentsWithRecords = documents.map((doc) =>
          withEnrichedRecord({ ...doc, extracted_record: extractedRecordsMap.get(doc.id) || null }, doc.document_type)
        );

        return reply.send({ documents: documentsWithRecords });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to list documents');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list documents',
        });
      }
    }
  );

  /**
   * GET /v1/documents/:id
   * Get document detail
   * M1-T4: Include extracted records
   */
  fastify.get(
    '/documents/:id',
    {
      onRequest: [authenticateRequest],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authReq = request as AuthenticatedRequest;
      
      try {
        const { id } = request.params as { id: string };

        const document = await documentService.getDocumentByIdAndUser(
          id,
          authReq.user!.id
        );

        if (!document) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Document not found',
          });
        }

        // Get extracted record if available
        const extractedRecord = await extractedRecordService.getExtractedRecordByDocumentId(document.id);

        // Generate presigned URL for PDF download
        const downloadUrl = await storageService.getPresignedUrl(
          document.storage_key,
          3600 // 1 hour
        );

        return reply.send({
          ...withEnrichedRecord({ ...document, extracted_record: extractedRecord || null }, document.document_type),
          download_url: downloadUrl,
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get document');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get document',
        });
      }
    }
  );

  /**
   * GET /v1/documents/:id/download
   * Stream document file for download (proxy to MinIO)
   * This endpoint allows downloading files from the host machine
   */
  fastify.get(
    '/documents/:id/download',
    {
      onRequest: [authenticateRequest],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authReq = request as AuthenticatedRequest;
      
      try {
        const { id } = request.params as { id: string };

        const document = await documentService.getDocumentByIdAndUser(
          id,
          authReq.user!.id
        );

        if (!document) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Document not found',
          });
        }

        // Stream file directly from MinIO
        const stream = await storageService.getDocumentStream(document.storage_key);
        
        // Set response headers for file download
        reply.type(document.content_type || 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="${document.id}.pdf"`);
        if (document.byte_size) {
          reply.header('Content-Length', document.byte_size.toString());
        }
        
        // Send the stream - Fastify will handle it automatically
        return reply.send(stream);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to download document');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to download document',
        });
      }
    }
  );

  /**
   * PATCH /v1/documents/:id/fields
   * Apply user corrections to extracted fields (M2-T5c)
   * Array fields are whole-field replacements: the client holds the current array from
   * the last GET, so an item edit/add/remove all become "send back the new array for
   * this key" — same {key, value} shape as a scalar correction.
   */
  fastify.patch(
    '/documents/:id/fields',
    {
      onRequest: [authenticateRequest],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authReq = request as AuthenticatedRequest;

      try {
        const { id } = request.params as { id: string };
        const body = request.body as { fields?: unknown };

        if (!Array.isArray(body?.fields) || body.fields.length === 0) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'fields must be a non-empty array',
          });
        }
        for (const entry of body.fields) {
          if (
            typeof entry !== 'object' ||
            entry === null ||
            typeof (entry as { key?: unknown }).key !== 'string' ||
            !('value' in (entry as object))
          ) {
            return reply.code(400).send({
              error: 'Bad Request',
              message: 'Each field correction needs a string key and a value',
            });
          }
        }
        const corrections = body.fields as FieldCorrectionInput[];

        const document = await documentService.getDocumentByIdAndUser(id, authReq.user!.id);
        if (!document) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Document not found',
          });
        }

        const extractedRecord = await extractedRecordService.getExtractedRecordByDocumentId(document.id);
        if (!extractedRecord) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'This document has no extracted fields yet',
          });
        }

        const module = getDocumentTypeModule(document.document_type);
        const fieldSpec = module?.schema.fields ?? GENERIC_FIELD_SPEC;
        const schemaVersion = module?.schema.schema_version ?? GENERIC_SCHEMA_VERSION;

        const { updatedFields, changed, unknownKeys, malformedKeys } = applyCorrections(
          extractedRecord.fields,
          corrections,
          fieldSpec
        );

        if (unknownKeys.length > 0 || malformedKeys.length > 0) {
          const parts: string[] = [];
          if (unknownKeys.length > 0) parts.push(`Unknown field key(s): ${unknownKeys.join(', ')}`);
          if (malformedKeys.length > 0) parts.push(`Value shape doesn't match the schema for: ${malformedKeys.join(', ')}`);
          return reply.code(400).send({
            error: 'Bad Request',
            message: parts.join('; '),
          });
        }

        const downloadUrl = await storageService.getPresignedUrl(document.storage_key, 3600);

        if (changed.length === 0) {
          return reply.send({
            ...withEnrichedRecord({ ...document, extracted_record: extractedRecord }, document.document_type),
            download_url: downloadUrl,
          });
        }

        const fieldValues = Object.fromEntries(updatedFields.map((f) => [f.key, f.value]));
        const denormalized = module
          ? mapDenormalized(module.schema, fieldValues)
          : { party_name: null, reference_id: null, amount: null, amount_frequency: null, key_date: null };

        const updatedRecord = await extractedRecordService.updateExtractedRecordFields({
          documentId: document.id,
          fields: updatedFields,
          partyName: denormalized.party_name,
          referenceId: denormalized.reference_id,
          amount: denormalized.amount,
          amountFrequency: denormalized.amount_frequency as any,
          keyDate: denormalized.key_date,
        });

        const newStatus = determineStatusAfterCorrection(updatedFields, fieldSpec);
        if (newStatus !== document.status) {
          await documentService.updateDocumentStatus(document.id, newStatus);
        }

        await recordFieldCorrections(
          changed.map((c) => ({
            userId: authReq.user!.id,
            documentId: document.id,
            extractedRecordId: extractedRecord.id,
            documentType: document.document_type,
            schemaVersion,
            fieldKey: c.key,
            previousValue: c.previousValue,
            newValue: updatedFields.find((f) => f.key === c.key)?.value ?? null,
            previousConfidence: c.previousConfidence,
            source: 'user_detail_edit',
          }))
        );

        await recordEvent({
          userId: authReq.user!.id,
          event: 'field_correction_saved',
          properties: { document_type: document.document_type, corrected_field_count: changed.length },
        });

        return reply.send({
          ...withEnrichedRecord({ ...document, status: newStatus, extracted_record: updatedRecord }, document.document_type),
          download_url: downloadUrl,
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update document fields');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update document fields',
        });
      }
    }
  );

  /**
   * DELETE /v1/documents/:id
   * Delete a document
   */
  fastify.delete(
    '/documents/:id',
    {
      onRequest: [authenticateRequest],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authReq = request as AuthenticatedRequest;
      
      try {
        const { id } = request.params as { id: string };

        const document = await documentService.getDocumentByIdAndUser(
          id,
          authReq.user!.id
        );

        if (!document) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'Document not found',
          });
        }

        // Delete from storage
        await storageService.deleteDocument(document.storage_key);

        // Delete from database
        await documentService.deleteDocument(id, authReq.user!.id);

        return reply.code(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'Failed to delete document');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete document',
        });
      }
    }
  );
}
