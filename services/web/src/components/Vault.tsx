/**
 * Vault Component
 * M1-T4: Vault list screen matching UX mock 04 at 99% fidelity
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
}

interface VaultProps {
  onNavigateToUpload: () => void;
  onNavigateToDetail: (documentId: string) => void;
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

// Helper to calculate days until a date
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const targetDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper to get countdown badge color and text
function getCountdownBadge(days: number | null): { color: string; bg: string; text: string } | null {
  if (days === null) return null;
  
  if (days < 0) {
    return { color: '#666', bg: '#f0f0f0', text: 'Expired' };
  } else if (days === 0) {
    return { color: '#fff', bg: '#dc3545', text: 'Today' };
  } else if (days === 1) {
    return { color: '#fff', bg: '#dc3545', text: 'Tomorrow' };
  } else if (days <= 7) {
    return { color: '#000', bg: '#ffc107', text: `${days} days` };
  } else if (days <= 30) {
    return { color: '#000', bg: '#17a2b8', text: `${days} days` };
  } else {
    return { color: '#000', bg: '#28a745', text: `${days} days` };
  }
}

// Helper to format amount with frequency
function formatAmount(amount: number | null, frequency: string | null): string {
  if (!amount) return '';
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  if (frequency === 'annual') {
    return `${formatted}/yr`;
  } else if (frequency === 'monthly') {
    return `${formatted}/mo`;
  } else if (frequency === 'quarterly') {
    return `${formatted}/qtr`;
  } else if (frequency === 'semi_annual') {
    return `${formatted}/6mo`;
  }
  
  return formatted;
}

export function Vault({ onNavigateToUpload, onNavigateToDetail }: VaultProps) {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8080/v1/documents?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  // Separate documents into upcoming and all
  const upcomingDocuments = documents.filter((doc) => {
    if (!doc.extracted_record?.key_date) return false;
    const days = daysUntil(doc.extracted_record.key_date);
    return days !== null && days >= 0 && days <= 30;
  }).sort((a, b) => {
    const daysA = daysUntil(a.extracted_record!.key_date);
    const daysB = daysUntil(b.extracted_record!.key_date);
    return (daysA ?? Infinity) - (daysB ?? Infinity);
  });

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
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: '1.75rem',
      fontWeight: '700',
      color: '#212529',
      margin: 0,
    },
    uploadBtn: {
      padding: '0.625rem 1.25rem',
      fontSize: '0.9375rem',
      fontWeight: '600',
      color: '#fff',
      backgroundColor: '#17a2b8',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    } as React.CSSProperties,
    content: {
      padding: '1.5rem',
      maxWidth: '800px',
      margin: '0 auto',
    },
    section: {
      marginBottom: '2rem',
    },
    sectionLabel: {
      fontSize: '0.75rem',
      fontWeight: '700',
      color: '#6c757d',
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
      marginBottom: '0.75rem',
    },
    documentCard: {
      backgroundColor: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '0.75rem',
      cursor: 'pointer',
      transition: 'box-shadow 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    } as React.CSSProperties,
    iconContainer: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      backgroundColor: '#e8f5e9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      position: 'relative' as const,
    },
    iconText: {
      fontSize: '1.5rem',
    },
    checkmark: {
      position: 'absolute' as const,
      top: '-4px',
      right: '-4px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: '#28a745',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
    },
    cardContent: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: '1rem',
      fontWeight: '600',
      color: '#212529',
      marginBottom: '0.25rem',
    },
    cardSubtitle: {
      fontSize: '0.875rem',
      color: '#6c757d',
      marginBottom: '0.25rem',
    },
    badge: {
      display: 'inline-block',
      padding: '0.25rem 0.625rem',
      borderRadius: '12px',
      fontSize: '0.75rem',
      fontWeight: '700',
    } as React.CSSProperties,
    emptyState: {
      textAlign: 'center' as const,
      padding: '3rem 1.5rem',
      color: '#6c757d',
    },
    emptyIcon: {
      fontSize: '4rem',
      marginBottom: '1rem',
    },
    emptyText: {
      fontSize: '1.125rem',
      marginBottom: '0.5rem',
      color: '#212529',
    },
    emptySubtext: {
      fontSize: '0.9375rem',
      color: '#6c757d',
      marginBottom: '1.5rem',
    },
    bottomNav: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      borderTop: '1px solid #e0e0e0',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.75rem',
    },
    navItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '0.25rem',
      cursor: 'pointer',
      padding: '0.5rem',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#17a2b8',
      fontWeight: '600',
      fontSize: '0.875rem',
    },
    navItemInactive: {
      color: '#6c757d',
    },
    navIcon: {
      fontSize: '1.5rem',
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Vault</h1>
        </div>
        <div style={{ ...styles.content, textAlign: 'center', padding: '3rem' }}>
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Vault</h1>
        </div>
        <div style={{ ...styles.content, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#dc3545' }}>{error}</p>
          <button
            onClick={fetchDocuments}
            style={{
              ...styles.uploadBtn,
              marginTop: '1rem',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Vault</h1>
        <button
          style={styles.uploadBtn}
          onClick={onNavigateToUpload}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#138496';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#17a2b8';
          }}
        >
          Upload
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {documents.length === 0 ? (
          /* Empty State */
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <div style={styles.emptyText}>No documents yet</div>
            <div style={styles.emptySubtext}>
              Upload your first document to get started
            </div>
            <button
              style={styles.uploadBtn}
              onClick={onNavigateToUpload}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#138496';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#17a2b8';
              }}
            >
              Upload Document
            </button>
          </div>
        ) : (
          <>
            {/* Upcoming Section */}
            {upcomingDocuments.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionLabel}>UPCOMING</div>
                {upcomingDocuments.map((doc) => {
                  const days = daysUntil(doc.extracted_record!.key_date);
                  const badge = getCountdownBadge(days);
                  
                  return (
                    <div
                      key={doc.id}
                      style={styles.documentCard}
                      onClick={() => onNavigateToDetail(doc.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={styles.iconContainer}>
                        <div style={styles.iconText}>
                          {doc.document_type === 'auto_policy' && '🚗'}
                          {doc.document_type === 'home_policy' && '🏠'}
                          {doc.document_type === 'life_insurance' && '🛡️'}
                          {doc.document_type === 'warranty' && '📋'}
                          {doc.document_type === 'tax' && '📊'}
                          {doc.document_type === 'receipt' && '🧾'}
                          {!['auto_policy', 'home_policy', 'life_insurance', 'warranty', 'tax', 'receipt'].includes(doc.document_type) && '📄'}
                        </div>
                        {doc.status === 'ready' && (
                          <div style={styles.checkmark}>✓</div>
                        )}
                      </div>
                      <div style={styles.cardContent}>
                        <div style={styles.cardTitle}>
                          {formatDocumentType(doc.document_type)}
                          {doc.extracted_record?.party_name && ` • ${doc.extracted_record.party_name}`}
                        </div>
                        {doc.extracted_record?.amount && (
                          <div style={styles.cardSubtitle}>
                            {formatAmount(doc.extracted_record.amount, doc.extracted_record.amount_frequency)}
                          </div>
                        )}
                        {badge && (
                          <div
                            style={{
                              ...styles.badge,
                              backgroundColor: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* All Documents Section */}
            <div style={styles.section}>
              <div style={styles.sectionLabel}>ALL DOCUMENTS</div>
              {documents.map((doc) => {
                const days = doc.extracted_record?.key_date ? daysUntil(doc.extracted_record.key_date) : null;
                const badge = getCountdownBadge(days);
                
                return (
                  <div
                    key={doc.id}
                    style={styles.documentCard}
                    onClick={() => onNavigateToDetail(doc.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={styles.iconContainer}>
                      <div style={styles.iconText}>
                        {doc.document_type === 'auto_policy' && '🚗'}
                        {doc.document_type === 'home_policy' && '🏠'}
                        {doc.document_type === 'life_insurance' && '🛡️'}
                        {doc.document_type === 'warranty' && '📋'}
                        {doc.document_type === 'tax' && '📊'}
                        {doc.document_type === 'receipt' && '🧾'}
                        {!['auto_policy', 'home_policy', 'life_insurance', 'warranty', 'tax', 'receipt'].includes(doc.document_type) && '📄'}
                      </div>
                      {doc.status === 'ready' && (
                        <div style={styles.checkmark}>✓</div>
                      )}
                    </div>
                    <div style={styles.cardContent}>
                      <div style={styles.cardTitle}>
                        {formatDocumentType(doc.document_type)}
                        {doc.extracted_record?.party_name && ` • ${doc.extracted_record.party_name}`}
                      </div>
                      {doc.extracted_record?.amount && (
                        <div style={styles.cardSubtitle}>
                          {formatAmount(doc.extracted_record.amount, doc.extracted_record.amount_frequency)}
                        </div>
                      )}
                      {badge && (
                        <div
                          style={{
                            ...styles.badge,
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.text}
                        </div>
                      )}
                      {doc.status === 'parsing' && (
                        <div style={{ ...styles.cardSubtitle, color: '#17a2b8' }}>
                          Processing...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={styles.bottomNav}>
        <button style={styles.navItem}>
          <div style={styles.navIcon}>📁</div>
          <div>Vault</div>
        </button>
        <button style={{ ...styles.navItem, ...styles.navItemInactive }}>
          <div style={styles.navIcon}>💬</div>
          <div>Ask</div>
        </button>
        <button style={{ ...styles.navItem, ...styles.navItemInactive }}>
          <div style={styles.navIcon}>⚙️</div>
          <div>Settings</div>
        </button>
      </div>

      {/* Bottom spacing for fixed nav */}
      <div style={{ height: '80px' }} />
    </div>
  );
}
