/**
 * MinIO storage service
 * M1-T3: Object storage for document PDFs
 */

import { Client as MinioClient } from 'minio';
import type { Readable } from 'stream';

const config = {
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
};

const BUCKET_NAME = 'kanak-documents';

let minioClient: MinioClient;

/**
 * Initialize MinIO client and ensure bucket exists
 */
export async function initMinIO(): Promise<void> {
  minioClient = new MinioClient(config);

  // Create bucket if it doesn't exist
  const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    console.log(`Created MinIO bucket: ${BUCKET_NAME}`);
  }
}

/**
 * Upload a PDF to MinIO
 * @param objectName - Unique object name (e.g., userId/documentId.pdf)
 * @param stream - File stream
 * @param size - File size in bytes
 * @param contentType - MIME type
 * @returns Object URL
 */
export async function uploadDocument(
  objectName: string,
  stream: Readable | Buffer,
  size: number,
  contentType: string = 'application/pdf'
): Promise<string> {
  await minioClient.putObject(BUCKET_NAME, objectName, stream, size, {
    'Content-Type': contentType,
  });

  return `${BUCKET_NAME}/${objectName}`;
}

/**
 * Generate a presigned URL for downloading a document
 * MinIO configured with MINIO_SERVER_URL=http://localhost:9000 will generate
 * presigned URLs with the correct external hostname and valid signatures.
 * 
 * @param objectName - Object name in MinIO
 * @param expirySeconds - URL validity duration (default 1 hour)
 * @returns Presigned URL accessible from browser
 */
export async function getPresignedUrl(
  objectName: string,
  expirySeconds: number = 3600
): Promise<string> {
  return await minioClient.presignedGetObject(
    BUCKET_NAME,
    objectName,
    expirySeconds
  );
}

/**
 * Get a stream for downloading a document
 * Use this for proxying downloads through the API
 * 
 * @param objectName - Object name in MinIO
 * @returns Readable stream of the document
 */
export async function getDocumentStream(objectName: string): Promise<Readable> {
  return await minioClient.getObject(BUCKET_NAME, objectName);
}

/**
 * Delete a document from MinIO
 * @param objectName - Object name to delete
 */
export async function deleteDocument(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_NAME, objectName);
}

/**
 * Get document metadata
 * @param objectName - Object name
 * @returns Stat info
 */
export async function statDocument(objectName: string) {
  return await minioClient.statObject(BUCKET_NAME, objectName);
}
