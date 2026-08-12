/**
 * DocumentDetail Component
 * M1-T4: Document detail screen matching UX mock 07 at 99% fidelity
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface FieldValue {
  key: string;
  label: string;
  value: string | number | boolean | null;
  confidence?: number;
  needsReview?: boolean;
  source?: string;
}

interface ExtractedRecord {
  id: string;
  document_id: string;
  schema_version: string;
  fields: FieldValue[];
  overall_confidence: number | null;
  party_name: string | null;
  reference_id: string | null;
  amount: number | null;
  amount_frequency: string | null;
  key_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  source: string;
  title: string | null;
  storage_key: string;
  content_type: string;
  byte_size: number | null;
  checksum_sha256: string | null;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
  extracted_record: ExtractedRecord | null;
  download_url?: string;
}

interface DocumentDetailProps {
  documentId: string;
  onBack: () => void;
}

// Helper to format document type for display
function formatDocumentType(type: string): string {
  const typeMap: Record<string, string> = {
    auto_policy: 'Auto Insurance',
    home_policy: 'Home Insurance',
    life_insurance: 'Life Insurance',
    warranty: 'Warranty',
    tax: 'Tax Document',
    receipt: 'Receipt',
    other: 'Document',
    unknown: 'Document',
  };
  return typeMap[type] || type;
}

// Helper to format field value for display
function formatFieldValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Check if it looks like a money value (has decimal or is large)
    if (value >= 100 || value.toString().includes('.')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return value.toString();
  }
  return value.toString();
}

// Helper to get field icon
function getFieldIcon(key: string): string {
  const iconMap: Record<string, string> = {
    carrier: '🏢',
    policy_number: '🔢',
    named_insured: '👤',
    insured_name: '👤',
    property_address: '📍',
    premium_annual: '💰',
    premium_term: '💵',
    renewal_date: '📅',
    effective_date: '📅',
    expiration_date: '📅',
    key_date: '📅',
    purchase_date: '📅',
    vehicle_year: '📅',
    vehicle_make: '🚗',
    vehicle_model: '🚗',
    vin: '🔑',
    garaging_zip: '📍',
    deductible: '💳',
    deductible_collision: '💳',
    deductible_comprehensive: '💳',
    deductible_wind_hail: '💳',
    dwelling_coverage: '🏠',
    personal_property_coverage: '📦',
    liability_coverage: '🛡️',
    liability_bodily_injury: '🛡️',
    liability_property_damage: '🛡️',
    death_benefit: '💰',
    policy_term: '⏰',
    issuer: '🏢',
    warranty_number: '🔢',
    product_name: '📱',
    purchase_price: '💰',
    warranty_cost: '💵',
    merchant: '🏪',
    order_number: '🔢',
    total_amount: '💰',
    item_description: '📝',
    tax_year: '📅',
    document_type: '📄',
    taxpayer_name: '👤',
  };
  return iconMap[key] || '📋';
}

export function DocumentDetail({ documentId, onBack }: DocumentDetailProps) {
  const { token } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  async function fetchDocument() {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8080/v1/documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Document not found');
        }
        throw new Error('Failed to fetch document');
      }

      const data = await response.json();
      setDocument(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    try {
      const response = await fetch(`http://localhost:8080/v1/documents/${documentId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `document-${documentId}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download document:', err);
      alert('Failed to download document');
    }
  }

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    header: {
      backgroundColor: '#fff',
      borderBottom: '1px solid #e0e0e0',
      padding: '1rem 1.5rem',
    },
    backButton: {
      background: 'none',
      border: 'none',
      color: '#17a2b8',
      fontSize: '0.9375rem',
      fontWeight: '600',
      cursor: 'pointer',
      padding: '0.5rem 0',
      marginBottom: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
    } as React.CSSProperties,
    title: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#212529',
      margin: 0,
    },
    content: {
      padding: '1.5rem',
      maxWidth: '800px',
      margin: '0 auto',
    },
    fieldCard: {
      backgroundColor: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '0.75rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '1rem',
    },
    fieldIcon: {
      fontSize: '1.5rem',
      flexShrink: 0,
      width: '40px',
      height: '40px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldContent: {
      flex: 1,
      minWidth: 0,
    },
    fieldLabel: {
      fontSize: '0.8125rem',
      fontWeight: '600',
      color: '#6c757d',
      marginBottom: '0.25rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    fieldValue: {
      fontSize: '1rem',
      fontWeight: '600',
      color: '#212529',
      marginBottom: '0.25rem',
      wordBreak: 'break-word' as const,
    },
    fieldSource: {
      fontSize: '0.75rem',
      color: '#6c757d',
      fontStyle: 'italic' as const,
    },
    button: {
      width: '100%',
      padding: '0.875rem 1.25rem',
      fontSize: '1rem',
      fontWeight: '600',
      color: '#fff',
      backgroundColor: '#17a2b8',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      marginBottom: '0.75rem',
      transition: 'background-color 0.2s',
    } as React.CSSProperties,
    buttonSecondary: {
      backgroundColor: '#6c757d',
    } as React.CSSProperties,
    statusBadge: {
      display: 'inline-block',
      padding: '0.25rem 0.75rem',
      borderRadius: '12px',
      fontSize: '0.8125rem',
      fontWeight: '600',
      marginTop: '0.5rem',
    } as React.CSSProperties,
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onBack}>
            ← Back
          </button>
        </div>
        <div style={{ ...styles.content, textAlign: 'center', padding: '3rem' }}>
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onBack}>
            ← Back
          </button>
        </div>
        <div style={{ ...styles.content, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#dc3545' }}>{error || 'Document not found'}</p>
          <button
            onClick={onBack}
            style={{
              ...styles.button,
              width: 'auto',
              marginTop: '1rem',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isInsurancePolicy = ['auto_policy', 'home_policy', 'life_insurance'].includes(document.document_type);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <h1 style={styles.title}>
          {formatDocumentType(document.document_type)}
          {document.extracted_record?.party_name && (
            <> • {document.extracted_record.party_name}</>
          )}
        </h1>
        {document.status === 'parsing' && (
          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: '#17a2b8',
              color: '#fff',
            }}
          >
            Processing...
          </div>
        )}
        {document.status === 'ready' && (
          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: '#28a745',
              color: '#fff',
            }}
          >
            Ready
          </div>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Extracted Fields */}
        {document.extracted_record && document.extracted_record.fields.length > 0 ? (
          <>
            {document.extracted_record.fields.map((field, index) => (
              <div key={index} style={styles.fieldCard}>
                <div style={styles.fieldIcon}>
                  {getFieldIcon(field.key)}
                </div>
                <div style={styles.fieldContent}>
                  <div style={styles.fieldLabel}>{field.label}</div>
                  <div style={styles.fieldValue}>
                    {formatFieldValue(field.value)}
                  </div>
                  <div style={styles.fieldSource}>
                    {field.source || 'from document'}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : document.status === 'parsing' ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
            <p>Processing document...</p>
            <p style={{ fontSize: '0.875rem' }}>This usually takes a few seconds</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
            <p>No extracted fields available</p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ marginTop: '2rem' }}>
          <button
            style={styles.button}
            onClick={handleDownload}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#138496';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#17a2b8';
            }}
          >
            Open original PDF
          </button>

          {isInsurancePolicy && document.status === 'ready' && (
            <button
              style={{ ...styles.button, backgroundColor: '#28a745' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#218838';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#28a745';
              }}
            >
              Compare rates
            </button>
          )}
        </div>
      </div>

      {/* Bottom spacing */}
      <div style={{ height: '2rem' }} />
    </div>
  );
}
