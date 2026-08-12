/**
 * Stub Parse Worker
 * M1-T4: Generates mock extracted fields for uploaded documents
 * Real AI parsing will be implemented in M2
 */

import {
  createExtractedRecord,
  FieldValue,
  AmountFrequency,
} from '../services/extracted-record.js';
import {
  updateDocumentStatus,
  DocumentType,
} from '../services/document.js';
import { query } from '../lib/db.js';

/**
 * Generate stub fields based on document type
 */
function generateStubFields(documentType: DocumentType): {
  fields: FieldValue[];
  partyName: string;
  referenceId: string;
  amount: number | null;
  amountFrequency: AmountFrequency | null;
  keyDate: string | null;
  schemaVersion: string;
} {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setMonth(futureDate.getMonth() + 2); // 2 months from now
  const futureDateStr = futureDate.toISOString().split('T')[0];

  switch (documentType) {
    case 'auto_policy':
      return {
        schemaVersion: 'auto_policy.v1',
        partyName: 'State Farm',
        referenceId: 'POL-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        amount: 1245.00,
        amountFrequency: 'annual',
        keyDate: futureDateStr,
        fields: [
          {
            key: 'carrier',
            label: 'Carrier',
            value: 'State Farm',
            confidence: 0.95,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'policy_number',
            label: 'Policy number',
            value: 'POL-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            confidence: 0.92,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'named_insured',
            label: 'Named insured',
            value: 'John Smith',
            confidence: 0.88,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'premium_annual',
            label: 'Annual premium',
            value: 1245.00,
            confidence: 0.90,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'renewal_date',
            label: 'Renewal / expiration date',
            value: futureDateStr,
            confidence: 0.93,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'effective_date',
            label: 'Effective date',
            value: today.toISOString().split('T')[0],
            confidence: 0.91,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'vehicle_year',
            label: 'Vehicle year',
            value: 2022,
            confidence: 0.94,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'vehicle_make',
            label: 'Vehicle make',
            value: 'Honda',
            confidence: 0.96,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'vehicle_model',
            label: 'Vehicle model',
            value: 'Accord',
            confidence: 0.95,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'deductible_collision',
            label: 'Collision deductible',
            value: 500,
            confidence: 0.89,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'deductible_comprehensive',
            label: 'Comprehensive deductible',
            value: 500,
            confidence: 0.89,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'liability_bodily_injury',
            label: 'Bodily injury liability',
            value: '100,000/300,000',
            confidence: 0.87,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'liability_property_damage',
            label: 'Property damage liability',
            value: '50,000',
            confidence: 0.87,
            needsReview: false,
            source: 'document',
          },
        ],
      };

    case 'home_policy':
      return {
        schemaVersion: 'home_policy.v1',
        partyName: 'Allstate',
        referenceId: 'HP-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        amount: 1850.00,
        amountFrequency: 'annual',
        keyDate: futureDateStr,
        fields: [
          {
            key: 'carrier',
            label: 'Carrier',
            value: 'Allstate',
            confidence: 0.96,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'policy_number',
            label: 'Policy number',
            value: 'HP-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            confidence: 0.93,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'named_insured',
            label: 'Named insured',
            value: 'Jane Doe',
            confidence: 0.90,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'property_address',
            label: 'Property address',
            value: '123 Main Street, Austin, TX 78701',
            confidence: 0.88,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'premium_annual',
            label: 'Annual premium',
            value: 1850.00,
            confidence: 0.91,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'renewal_date',
            label: 'Renewal / expiration date',
            value: futureDateStr,
            confidence: 0.94,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'effective_date',
            label: 'Effective date',
            value: today.toISOString().split('T')[0],
            confidence: 0.92,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'dwelling_coverage',
            label: 'Dwelling coverage (A)',
            value: 350000,
            confidence: 0.89,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'personal_property_coverage',
            label: 'Personal property coverage',
            value: 175000,
            confidence: 0.87,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'liability_coverage',
            label: 'Liability coverage',
            value: 300000,
            confidence: 0.88,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'deductible',
            label: 'All-peril deductible',
            value: 2500,
            confidence: 0.90,
            needsReview: false,
            source: 'document',
          },
        ],
      };

    case 'life_insurance':
      return {
        schemaVersion: 'life_insurance.v1',
        partyName: 'MetLife',
        referenceId: 'LIFE-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        amount: 500000,
        amountFrequency: 'one_time',
        keyDate: futureDateStr,
        fields: [
          {
            key: 'carrier',
            label: 'Carrier',
            value: 'MetLife',
            confidence: 0.95,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'policy_number',
            label: 'Policy number',
            value: 'LIFE-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            confidence: 0.93,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'insured_name',
            label: 'Insured name',
            value: 'Robert Johnson',
            confidence: 0.91,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'death_benefit',
            label: 'Death benefit',
            value: 500000,
            confidence: 0.94,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'premium_annual',
            label: 'Annual premium',
            value: 480.00,
            confidence: 0.90,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'policy_term',
            label: 'Policy term',
            value: '20 years',
            confidence: 0.88,
            needsReview: false,
            source: 'document',
          },
        ],
      };

    case 'warranty':
      return {
        schemaVersion: 'warranty.v1',
        partyName: 'Best Buy',
        referenceId: 'WRT-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        amount: 299.99,
        amountFrequency: 'one_time',
        keyDate: futureDateStr,
        fields: [
          {
            key: 'issuer',
            label: 'Issuer',
            value: 'Best Buy',
            confidence: 0.94,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'warranty_number',
            label: 'Warranty number',
            value: 'WRT-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            confidence: 0.91,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'product_name',
            label: 'Product name',
            value: 'MacBook Pro 16"',
            confidence: 0.93,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'purchase_price',
            label: 'Purchase price',
            value: 2499.00,
            confidence: 0.92,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'warranty_cost',
            label: 'Warranty cost',
            value: 299.99,
            confidence: 0.90,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'expiration_date',
            label: 'Expiration date',
            value: futureDateStr,
            confidence: 0.89,
            needsReview: false,
            source: 'document',
          },
        ],
      };

    case 'tax':
      return {
        schemaVersion: 'generic.v1',
        partyName: 'IRS',
        referenceId: 'TAX-' + new Date().getFullYear().toString(),
        amount: null,
        amountFrequency: null,
        keyDate: null,
        fields: [
          {
            key: 'tax_year',
            label: 'Tax year',
            value: new Date().getFullYear() - 1,
            confidence: 0.95,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'document_type',
            label: 'Document type',
            value: 'Form 1040',
            confidence: 0.92,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'taxpayer_name',
            label: 'Taxpayer name',
            value: 'Example Taxpayer',
            confidence: 0.88,
            needsReview: false,
            source: 'document',
          },
        ],
      };

    case 'receipt':
      return {
        schemaVersion: 'receipt.v1',
        partyName: 'Amazon',
        referenceId: 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase(),
        amount: 149.99,
        amountFrequency: 'one_time',
        keyDate: null,
        fields: [
          {
            key: 'merchant',
            label: 'Merchant',
            value: 'Amazon',
            confidence: 0.96,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'order_number',
            label: 'Order number',
            value: 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase(),
            confidence: 0.93,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'purchase_date',
            label: 'Purchase date',
            value: today.toISOString().split('T')[0],
            confidence: 0.94,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'total_amount',
            label: 'Total amount',
            value: 149.99,
            confidence: 0.91,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'item_description',
            label: 'Item description',
            value: 'Wireless Headphones',
            confidence: 0.87,
            needsReview: false,
            source: 'document',
          },
        ],
      };

    case 'other':
    case 'unknown':
    default:
      return {
        schemaVersion: 'generic.v1',
        partyName: 'Document',
        referenceId: 'DOC-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        amount: null,
        amountFrequency: null,
        keyDate: null,
        fields: [
          {
            key: 'title',
            label: 'Title',
            value: 'Uploaded Document',
            confidence: 0.85,
            needsReview: false,
            source: 'document',
          },
          {
            key: 'date',
            label: 'Date',
            value: today.toISOString().split('T')[0],
            confidence: 0.80,
            needsReview: false,
            source: 'document',
          },
        ],
      };
  }
}

/**
 * Process a single pending document
 */
async function processDocument(documentId: string, documentType: DocumentType) {
  console.log(`[StubParseWorker] Processing document ${documentId} (${documentType})`);

  try {
    // Update status to parsing
    await updateDocumentStatus(documentId, 'parsing');

    // Simulate parsing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate stub fields
    const stubData = generateStubFields(documentType);

    // Create extracted record
    await createExtractedRecord({
      documentId,
      schemaVersion: stubData.schemaVersion,
      fields: stubData.fields,
      overallConfidence: 0.90,
      partyName: stubData.partyName,
      referenceId: stubData.referenceId,
      amount: stubData.amount ?? undefined,
      amountFrequency: stubData.amountFrequency ?? undefined,
      keyDate: stubData.keyDate ?? undefined,
    });

    // Update status to ready
    await updateDocumentStatus(documentId, 'ready');

    console.log(`[StubParseWorker] Completed document ${documentId}`);
  } catch (error) {
    console.error(`[StubParseWorker] Error processing document ${documentId}:`, error);
    await updateDocumentStatus(documentId, 'failed');
  }
}

/**
 * Poll for pending documents and process them
 */
async function pollAndProcess() {
  try {
    const result = await query<{ id: string; document_type: DocumentType }>(
      `
      SELECT id, document_type
      FROM documents
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
      `
    );

    if (result.rows.length > 0) {
      console.log(`[StubParseWorker] Found ${result.rows.length} pending documents`);
      
      // Process documents sequentially
      for (const doc of result.rows) {
        await processDocument(doc.id, doc.document_type);
      }
    }
  } catch (error) {
    console.error('[StubParseWorker] Error polling documents:', error);
  }
}

/**
 * Start the stub parse worker
 */
export function startStubParseWorker() {
  console.log('[StubParseWorker] Starting stub parse worker');
  
  // Poll every 2 seconds
  setInterval(pollAndProcess, 2000);
  
  // Process immediately on start
  pollAndProcess();
}
