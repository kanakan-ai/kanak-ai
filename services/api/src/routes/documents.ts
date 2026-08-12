/**
 * Document routes
 * M1-T3: PDF upload and vault endpoints
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { authenticateRequest } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import * as documentService from '../services/document.js';
import * as storageService from '../services/storage.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_DOCUMENT_TYPES = [
  'auto_policy',
  'home_policy',
  'life_insurance',
  'warranty',
  'tax',
  'receipt',
  'other',
] as const;

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

        // Validate fields
        const documentType = (data.fields.documentType as any)?.value;
        const source = ((data.fields.source as any)?.value || 'upload') as documentService.DocumentSource;

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

        // Create document record
        const document = await documentService.createDocument({
          userId: authReq.user!.id,
          documentType: documentType as documentService.DocumentType,
          source,
          storageKey,
          contentType: data.mimetype,
          byteSize: totalSize,
          checksum: fileHash,
        });

        // TODO M1: Enqueue parse job (stubbed for now)
        // In M2, this will trigger actual AI parse
        await documentService.updateDocumentStatus(document.id, 'parsing');

        return reply.code(202).send({
          documentId: document.id,
          status: 'accepted',
          message: 'Document uploaded and queued for processing',
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

        return reply.send({ documents });
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

        // Generate presigned URL for PDF download
        const downloadUrl = await storageService.getPresignedUrl(
          document.storage_key,
          3600 // 1 hour
        );

        return reply.send({
          ...document,
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
