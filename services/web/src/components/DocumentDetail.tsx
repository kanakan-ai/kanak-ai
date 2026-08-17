import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/v1';
const RETENTION_DAYS = Number(import.meta.env.VITE_DOCUMENT_RETENTION_DAYS) || 14;

type FieldScalarValue = string | number | boolean | null;
type FieldArrayItemValue = FieldScalarValue | Record<string, FieldScalarValue>;

interface Field {
  key: string;
  label: string;
  value: FieldScalarValue | FieldArrayItemValue[];
  confidence?: number;
  needsReview?: boolean;
  source?: string;
  /** Review UI accordion section; present on scalar fields only. Absent on array fields. */
  group?: string;
}

interface Document {
  id: string;
  document_type: string;
  status: string;
  updated_at: string;
  extracted_record: { party_name: string | null; fields: Field[] } | null;
}

const typeLabel: Record<string, string> = {
  auto_policy: 'Auto policy',
  home_policy: 'Home policy',
  life_insurance: 'Life insurance',
  warranty: 'Warranty',
  tax: 'Tax document',
  receipt: 'Receipt',
  umbrella_policy: 'Umbrella policy',
  landlord_policy: 'Landlord policy',
  renters_policy: 'Renters policy',
  long_term_care: 'Long-term care insurance',
  other: 'Document',
};

function isArrayValue(value: Field['value']): value is FieldArrayItemValue[] {
  return Array.isArray(value);
}

function isObjectItem(item: FieldArrayItemValue): item is Record<string, FieldScalarValue> {
  return typeof item === 'object' && item !== null;
}

function humanize(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function valueFor(value: FieldScalarValue) {
  if (value === null) return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// Mirrors services/api/src/services/document-retention.ts's daysUntilRemoval — display-only here.
function daysUntilRemoval(updatedAt: string) {
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) return RETENTION_DAYS;
  return Math.ceil((RETENTION_DAYS * 86400000 - (Date.now() - parsed.getTime())) / 86400000);
}

function formatRetentionCountdown(updatedAt: string) {
  const remaining = daysUntilRemoval(updatedAt);
  return remaining > 0
    ? `It'll be automatically removed in ${remaining} day${remaining === 1 ? '' : 's'} if left unresolved.`
    : "It'll be removed soon if left unresolved.";
}

/**
 * document-type-modules.md rule 6: one collapsible section per distinct scalar `group`,
 * plus one per array field — driven entirely by field metadata, no per-document-type
 * section list here.
 */
interface Section {
  id: string;
  title: string;
  badge?: string;
  needsReview: boolean;
  scalarFields?: Field[];
  arrayField?: Field;
}

function buildSections(fields: Field[]): Section[] {
  const scalarGroups = new Map<string, Field[]>();
  const arraySections: Section[] = [];

  for (const field of fields) {
    if (isArrayValue(field.value)) {
      arraySections.push({
        id: `array:${field.key}`,
        title: field.label,
        badge: `${field.value.length} ${field.value.length === 1 ? 'item' : 'items'}`,
        needsReview: !!field.needsReview || field.value.length === 0,
        arrayField: field,
      });
    } else {
      const group = field.group || 'details';
      if (!scalarGroups.has(group)) scalarGroups.set(group, []);
      scalarGroups.get(group)!.push(field);
    }
  }

  const scalarSections: Section[] = Array.from(scalarGroups.entries()).map(([group, groupFields]) => ({
    id: `group:${group}`,
    title: humanize(group),
    needsReview: groupFields.some((f) => f.needsReview),
    scalarFields: groupFields,
  }));

  return [...scalarSections, ...arraySections];
}

function ArrayItemCard({ item }: { item: FieldArrayItemValue }) {
  if (!isObjectItem(item)) {
    return <div className="array-item-card"><span>{valueFor(item)}</span></div>;
  }
  return (
    <div className="array-item-card">
      {Object.entries(item).map(([key, value]) => (
        <div className="array-item-row" key={key}>
          <span className="array-item-key">{humanize(key)}</span>
          <span className="array-item-value">{valueFor(value)}</span>
        </div>
      ))}
    </div>
  );
}

function AccordionSection({ section }: { section: Section }) {
  return (
    <details className="accordion-section" open={section.needsReview}>
      <summary>
        <span className="accordion-title">{section.title}</span>
        {section.badge && <span className="accordion-badge">{section.badge}</span>}
        {section.needsReview && <span className="accordion-badge review">Needs review</span>}
      </summary>
      <div className="accordion-body">
        {section.scalarFields && (
          <div className="field-row-list">
            {section.scalarFields.map((field) => (
              <div className="field-row" key={field.key}>
                <span className="field-row-label">{field.label}</span>
                <span className="field-row-value">{valueFor(field.value as FieldScalarValue)}</span>
              </div>
            ))}
          </div>
        )}
        {section.arrayField &&
          (isArrayValue(section.arrayField.value) && section.arrayField.value.length > 0 ? (
            <div className="array-item-list">
              {section.arrayField.value.map((item, index) => (
                <ArrayItemCard item={item} key={index} />
              ))}
            </div>
          ) : (
            <p className="status-message small">No {section.title.toLowerCase()} found on this document.</p>
          ))}
      </div>
    </details>
  );
}

export function DocumentDetail({ documentId, onBack }: { documentId: string; onBack: () => void }) {
  const { token } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replaceMismatchWarning, setReplaceMismatchWarning] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    void load();
  }, [documentId, token]);

  async function load() {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      setDocument(await response.json());
    } catch {
      setError('We could not load this document.');
    }
  }

  async function download() {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement('a');
      link.href = url;
      link.download = 'kanak-document.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('The original PDF could not be downloaded.');
    }
  }

  async function deleteDocument() {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      onBack();
    } catch {
      setError('This document could not be removed. Please try again.');
      setIsDeleting(false);
    }
  }

  function resetReplace() {
    setReplacing(false);
    setReplaceFile(null);
    setReplaceError(null);
    setReplaceMismatchWarning(null);
  }

  async function submitReplacement(confirmTypeOverride: boolean) {
    if (!replaceFile || !document) return;
    setReplaceError(null);
    setIsReplacing(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceFile);
      formData.append('documentType', document.document_type);
      formData.append('source', 'upload');
      if (confirmTypeOverride) formData.append('confirmTypeOverride', 'true');
      const uploadResponse = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        if (uploadData.requiresConfirmation) {
          setReplaceMismatchWarning(uploadData.message);
          return;
        }
        throw new Error(uploadData.message || 'Replacement upload failed');
      }
      setReplaceMismatchWarning(null);
      const deleteResponse = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!deleteResponse.ok) {
        throw new Error(
          'The new document was uploaded, but the original could not be removed. Both are now in your vault — please remove the old one manually.'
        );
      }
      onBack();
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Replacement failed.');
    } finally {
      setIsReplacing(false);
    }
  }

  if (error) {
    return (
      <main className="page-content">
        <button className="back-link" onClick={onBack}>← Back to Vault</button>
        <div className="notice error">{error}</div>
      </main>
    );
  }
  if (!document) {
    return (
      <main className="page-content">
        <p className="status-message">Loading document…</p>
      </main>
    );
  }

  const title = `${typeLabel[document.document_type] ?? 'Document'}${
    document.extracted_record?.party_name ? ` · ${document.extracted_record.party_name}` : ''
  }`;
  const statusLabel =
    document.status === 'ready' ? 'Ready' : document.status === 'needs_review' ? 'Needs review' : 'Processing';
  const emptyStateMessage =
    document.status === 'needs_review'
      ? `This document doesn't look like the selected type (${
          typeLabel[document.document_type] ?? 'Document'
        }). Open the original PDF to check, then delete and re-upload with the correct type if needed. ${formatRetentionCountdown(
          document.updated_at
        )}`
      : 'Your document is being processed. Check back shortly.';

  const sections = document.extracted_record?.fields ? buildSections(document.extracted_record.fields) : null;

  return (
    <main className="page-content narrow">
      <button className="back-link" onClick={onBack}>← Back to Vault</button>
      <header className="detail-heading">
        <p className="eyebrow">Document details</p>
        <div>
          <h1>{title}</h1>
          <span className={`status-pill ${document.status}`}>{statusLabel}</span>
        </div>
        <p className="page-subtitle">Details extracted from your original document.</p>
      </header>
      <section className="accordion-list">
        {sections && sections.length > 0 ? (
          sections.map((section) => <AccordionSection section={section} key={section.id} />)
        ) : (
          <p className="status-message">{emptyStateMessage}</p>
        )}
      </section>
      {confirmingDelete ? (
        <div className="notice warning">
          <p>Remove this document from your vault? This can't be undone — the original file is deleted too.</p>
          <div className="notice-actions">
            <button className="button secondary" type="button" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
              Cancel
            </button>
            <button className="button danger" type="button" onClick={() => void deleteDocument()} disabled={isDeleting}>
              {isDeleting ? 'Removing…' : 'Remove document'}
            </button>
          </div>
        </div>
      ) : replacing ? (
        <div className="notice warning">
          <p>Choose a replacement PDF. Once it uploads successfully, the original document is deleted.</p>
          <label>
            Replacement PDF file
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setReplaceMismatchWarning(null);
                if (selected && (selected.type !== 'application/pdf' || selected.size > 25 * 1024 * 1024)) {
                  setReplaceFile(null);
                  setReplaceError(
                    selected.type !== 'application/pdf' ? 'Only PDF files are supported.' : 'Files must be 25 MB or smaller.'
                  );
                  return;
                }
                setReplaceFile(selected);
                setReplaceError(null);
              }}
              disabled={isReplacing}
            />
          </label>
          {replaceFile && <p className="file-name">Selected: {replaceFile.name}</p>}
          {replaceError && <div className="notice error">{replaceError}</div>}
          {replaceMismatchWarning && (
            <div className="notice warning">
              <p>{replaceMismatchWarning}</p>
              <div className="notice-actions">
                <button className="button secondary" type="button" onClick={() => setReplaceMismatchWarning(null)} disabled={isReplacing}>
                  Choose a different file
                </button>
                <button className="button primary" type="button" onClick={() => void submitReplacement(true)} disabled={isReplacing}>
                  {isReplacing ? 'Uploading…' : 'Upload anyway'}
                </button>
              </div>
            </div>
          )}
          <div className="notice-actions">
            <button className="button secondary" type="button" onClick={resetReplace} disabled={isReplacing}>
              Cancel
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => void submitReplacement(false)}
              disabled={isReplacing || !replaceFile || !!replaceMismatchWarning}
            >
              {isReplacing ? 'Uploading…' : 'Upload replacement'}
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-actions">
          <button className="button secondary" onClick={() => void download()}>Open original PDF</button>
          {['auto_policy', 'home_policy'].includes(document.document_type) && (
            <button className="button primary" type="button">Compare rates</button>
          )}
          <button className="button secondary" type="button" onClick={() => setReplacing(true)}>Replace document</button>
          <button className="button danger-outline" type="button" onClick={() => setConfirmingDelete(true)}>Remove document</button>
        </div>
      )}
    </main>
  );
}
