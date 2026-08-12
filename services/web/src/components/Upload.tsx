/**
 * Upload Component
 * M1-T3: PDF upload with document type selection
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const DOCUMENT_TYPES = [
  { value: 'auto_policy', label: 'Auto Insurance Policy' },
  { value: 'home_policy', label: 'Home Insurance Policy' },
  { value: 'life_insurance', label: 'Life Insurance Policy' },
  { value: 'warranty', label: 'Warranty / Extended Warranty' },
  { value: 'tax', label: 'Tax Document' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other Document' },
];

interface UploadProps {
  onUploadComplete?: () => void;
}

export const Upload: React.FC<UploadProps> = ({ onUploadComplete }) => {
  const { token } = useAuth();
  const [documentType, setDocumentType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      // Validate file type
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are supported');
        setFile(null);
        return;
      }

      // Validate file size (25MB)
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError('File size exceeds 25MB limit');
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !documentType) {
      setError('Please select a file and document type');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('source', 'upload');

      const response = await fetch('http://localhost:8080/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();
      setUploadProgress(100);
      setSuccess(
        `Document uploaded successfully! Processing document ID: ${data.documentId}`
      );
      
      // Reset form
      setFile(null);
      setDocumentType('');
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Callback for parent component
      if (onUploadComplete) {
        setTimeout(onUploadComplete, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#ffffff',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              marginBottom: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Upload Document
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Upload a PDF to your secure vault
          </p>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUpload}>
          <div
            style={{
              background: '#1a1a2e',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Document Type Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="document-type"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#e5e7eb',
                }}
              >
                Document Type *
              </label>
              <select
                id="document-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  background: '#0a0a0a',
                  color: '#ffffff',
                  outline: 'none',
                }}
              >
                <option value="">Select document type...</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* File Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="file-input"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#e5e7eb',
                }}
              >
                PDF File *
              </label>
              <input
                id="file-input"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  background: '#0a0a0a',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
              {file && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#9ca3af',
                  }}
                >
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)}{' '}
                  MB)
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && uploadProgress > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: '#374151',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#9ca3af',
                    textAlign: 'center',
                  }}
                >
                  Uploading... {uploadProgress}%
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div
                style={{
                  marginBottom: '24px',
                  padding: '12px',
                  background: '#7f1d1d',
                  border: '1px solid #991b1b',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#fecaca',
                }}
              >
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div
                style={{
                  marginBottom: '24px',
                  padding: '12px',
                  background: '#065f46',
                  border: '1px solid #059669',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#a7f3d0',
                }}
              >
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isUploading || !file || !documentType}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                background:
                  isUploading || !file || !documentType
                    ? '#374151'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#ffffff',
                cursor:
                  isUploading || !file || !documentType ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: isUploading || !file || !documentType ? 0.5 : 1,
              }}
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>

        {/* File Requirements */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: '#1a1a2e',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#9ca3af',
          }}
        >
          <div style={{ fontWeight: '500', marginBottom: '8px' }}>
            File Requirements:
          </div>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            <li>PDF format only</li>
            <li>Maximum file size: 25 MB</li>
            <li>Documents are encrypted and stored securely</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
