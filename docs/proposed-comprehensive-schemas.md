# Proposal: comprehensive schemas for all 9 document types (nested/array fields)

**Status**: Draft, Phase A — **all 9 schemas now written to full depth and validated** (structural checks: valid JSON, no duplicate keys, every `denormalized_columns` reference resolves to a real top-level field). Awaiting your review. Nothing applied yet; all target files live in `kanak-ai-specs`.
**Phase B** (after you apply this): rework the app-side type system (`document-types/`, `parse/`, `DocumentDetail.tsx` rendering) to actually support array-valued fields. Not started — that's real work built on top of whatever field shapes you approve here, so it happens after, not in parallel.

---

## 1. Field-shape convention (new)

Extends the existing flat `{key, label, type, required, review_if_low_confidence, enum?}` shape with one new structural primitive: **arrays**. Two kinds:

**Array of scalars** (e.g. a list of covered care types):
```json
{ "key": "care_types_covered", "label": "Care types covered", "type": "array",
  "required": false, "review_if_low_confidence": false,
  "items": { "type": "string" } }
```

**Array of flat objects** (e.g. multiple vehicles) — this is the one that matches your pasted schema's `vehicles[]`/`drivers[]`/`namedInsureds[]`/`discountsApplied[]`:
```json
{ "key": "vehicles", "label": "Vehicles insured", "type": "array",
  "required": true, "review_if_low_confidence": true,
  "items": { "type": "object", "properties": [
    { "key": "vehicle_id", "label": "Vehicle ID", "type": "string", "required": false, "review_if_low_confidence": false },
    { "key": "year", "label": "Year", "type": "number", "required": true, "review_if_low_confidence": false }
  ] } }
```

**Deliberate simplification vs. your pasted schema**: object-array items stay **one level deep** — no arrays-within-arrays, no further nested objects inside an array item. Two consequences, both restructurings that keep 100% of the information, just flattened one level:
- Your `vehicles[].garagingAddress` (nested object) becomes flat properties on the vehicle item: `garaging_city`, `garaging_state`, `garaging_postal_code`.
- Your `vehiclesCoverageEndorsementsAndOtherCharges[].endorsements[]` / `.otherCharges[]` (arrays nested inside an array item) become their own **policy-level** arrays with an optional `vehicle_id_ref` to link back to the specific vehicle, instead of nesting an array inside each vehicle. Same data, one less nesting level.

Singular (non-repeating) groupings — `policyInformation`, `policyLevelCoverageAndLimits`, `agentDetails`, `liabilityInsuranceCard` — are **not** modeled as nested objects at all; they're flattened into well-prefixed top-level scalar fields (`bi_per_person_limit`, `agent_name`, `card_vehicle_description`, etc.). This avoids introducing a second nesting primitive (standalone nested objects, as opposed to arrays) for cases that don't actually repeat — `array` is the only new structural type needed.

**Second addition: a `group` tag on every scalar field** (added for the review UI — see "why" below):
```json
{ "key": "carrier", "label": "Carrier / underwriting company", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" }
```
- Every non-array field must have a `group` (e.g. `policy`, `agent`, `premium`, `coverage`, `property`). Array fields and array-item properties must **not** have one — an array is already its own natural grouping, using its own `label` as the section name.
- **Why**: with schemas this large (25–53 fields plus several arrays), a flat full-page field list doesn't scale. The plan is a review UI with collapsible sections — one per `group` value (for scalars) plus one per array (arrays render as "Vehicles (2)" etc., with one card per item) — driven entirely by this metadata, not hardcoded per document type. This keeps the "no type-specific conditionals in core services/UI" rule intact: the accordion component just groups whatever the schema declares.

---

## 2. `design/api/openapi.yaml` — `FieldValue.value` type extension

```diff
 FieldValue:
   type: object
   required: [key, value]
   properties:
     ...
     value:
-      type: [string, number, "null"]
+      description: |
+        Scalar for a simple field, or an array for a repeating-entity field
+        (see design/document-type-modules.md's array field convention).
+        Array items are either scalars or flat objects (one level deep —
+        no further nested arrays/objects inside an item).
+      oneOf:
+        - type: [string, number, boolean, "null"]
+        - type: array
+          items:
+            oneOf:
+              - type: [string, number, boolean, "null"]
+              - type: object
```

(Also fixes a pre-existing small gap — `boolean` wasn't in the scalar union at all, despite some fields being naturally boolean, e.g. `is_primary_named_insured`.)

---

## 3. Comprehensive `auto_policy.v1.json` (full replacement, v2 — corrected)

**Changelog vs. the first draft, after a full field-by-field audit against your original schema:**
1. **Added `um_pd_*` policy-level fields were *not* added** — your source schema only has UM property-damage at the **per-vehicle** level (§8's `coverages` object), never policy-level (§7 only has UM *bodily injury*). Matched that exactly — see `vehicle_coverages[]` below, not a policy-level flat field.
2. **New `vehicle_coverages[]` array** — restores the per-vehicle coverage breakdown (§8's `coverages` object: BI, PD, UM-BI, **UM-PD**, PIP, collision, comprehensive, rental reimbursement, roadside assistance — nine coverage types, each with `isIncluded`/limits/deductible/premium) that the first draft dropped by only keeping the policy-level versions. Modeled as one row per vehicle × coverage type (normalized), replacing the ad hoc `collision_*`/`comprehensive_*`/`rental_reimbursement_*`/`roadside_assistance_*` fields that were bolted directly onto each vehicle item — those are now just rows in this array, which also fixes the missing `isIncluded` flags (previously only roadside assistance had one).
3. **New `insurance_cards[]` array** (replaces the flat `card_vehicle_description`/`card_disclaimer_text` fields) — a real policy normally has one ID card **per vehicle**, so this needed to be an array from the start. Restores `insuredName` (the card's own display name, which can differ from the structured `named_insureds[]` records) and adds `vehicle_id_ref` so a card can be linked to the specific vehicle it's for — both were silently dropped as "redundant" in the first draft when they aren't.

```json
{
  "schema_version": "auto_policy.v1",
  "document_type": "auto_policy",
  "description": "Comprehensive auto insurance declarations / proof-of-insurance extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier / underwriting company", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "billing_account_number", "label": "Billing account number", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","CANCELLED","PENDING","EXPIRED"] },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / expiration date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "term_months", "label": "Term length (months)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": [6,12] },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "gross_premium", "label": "Gross premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "total_discounts_amount", "label": "Total discounts", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "premium_annual", "label": "Total policy premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "fees_and_surcharges", "label": "Fees and surcharges", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "bi_per_person_limit", "label": "Bodily injury — per person limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "bi_per_occurrence_limit", "label": "Bodily injury — per occurrence limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "bi_premium", "label": "Bodily injury premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "pd_per_occurrence_limit", "label": "Property damage — per occurrence limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "pd_premium", "label": "Property damage premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "um_bi_per_person_limit", "label": "Uninsured motorist BI — per person limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "um_bi_per_occurrence_limit", "label": "Uninsured motorist BI — per occurrence limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "um_bi_premium", "label": "Uninsured motorist BI premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "pip_limit", "label": "Personal injury protection limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "pip_deductible", "label": "Personal injury protection deductible", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "pip_premium", "label": "Personal injury protection premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "medical_expense_limit_per_person", "label": "Medical expense limit per person", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "medical_expense_premium", "label": "Medical expense premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "named_insureds", "label": "Named insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "middle_name", "label": "Middle name", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "suffix", "label": "Suffix", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_named_insured", "label": "Primary named insured", "type": "boolean", "required": true, "review_if_low_confidence": false },
        { "key": "email", "label": "Email", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "phone", "label": "Phone", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street1", "label": "Address line 1", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street2", "label": "Address line 2", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_city", "label": "City", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_state", "label": "State", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_postal_code", "label": "Postal code", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "vehicles", "label": "Vehicles insured", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "vehicle_id", "label": "Vehicle ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "year", "label": "Year", "type": "number", "required": true, "review_if_low_confidence": false },
        { "key": "make", "label": "Make", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "model", "label": "Model", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "series", "label": "Series / trim", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "vin", "label": "VIN", "type": "string", "required": false, "review_if_low_confidence": true },
        { "key": "garaging_city", "label": "Garaging city", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "garaging_state", "label": "Garaging state", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "garaging_postal_code", "label": "Garaging ZIP", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "vehicle_premium", "label": "Vehicle premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "vehicle_coverages", "label": "Per-vehicle coverage details", "type": "array", "required": false, "review_if_low_confidence": true,
      "description": "One row per vehicle x coverage type — restores your §8 per-vehicle coverages object (BI/PD/UM-BI/UM-PD/PIP/collision/comprehensive/rental reimbursement/roadside assistance), normalized instead of nested under each vehicle.",
      "items": { "type": "object", "properties": [
        { "key": "vehicle_id_ref", "label": "Vehicle ID", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "coverage_type", "label": "Coverage type", "type": "string", "required": true, "review_if_low_confidence": false, "enum": ["BODILY_INJURY_LIABILITY","PROPERTY_DAMAGE_LIABILITY","UM_BODILY_INJURY","UM_PROPERTY_DAMAGE","PERSONAL_INJURY_PROTECTION","COLLISION","COMPREHENSIVE","RENTAL_REIMBURSEMENT","ROADSIDE_ASSISTANCE"] },
        { "key": "is_included", "label": "Included", "type": "boolean", "required": false, "review_if_low_confidence": false },
        { "key": "per_person_limit", "label": "Per person limit", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "per_occurrence_limit", "label": "Per occurrence limit", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "deductible", "label": "Deductible", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "daily_limit", "label": "Daily limit", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "max_limit", "label": "Max limit", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "drivers", "label": "Listed drivers", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "driver_id", "label": "Driver ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "dob", "label": "Date of birth", "type": "date", "required": false, "review_if_low_confidence": false },
        { "key": "gender", "label": "Gender", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "marital_status", "label": "Marital status", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "license_number", "label": "License number", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "license_state", "label": "License state", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "relationship_to_insured", "label": "Relationship to insured", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["SELF","SPOUSE","CHILD","OTHER"] },
        { "key": "driver_status", "label": "Driver status", "type": "string", "required": true, "review_if_low_confidence": false, "enum": ["ACTIVE","EXCLUDED","REMOVED"] }
      ] } },

    { "key": "discounts", "label": "Discounts applied", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "discount_code", "label": "Discount code", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "discount_name", "label": "Discount name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["POLICY","VEHICLE","DRIVER","TELEMATICS"] },
        { "key": "target_id_ref", "label": "Target ID (vehicle/driver)", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "discount_type", "label": "Discount type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["PERCENTAGE","FLAT_AMOUNT"] },
        { "key": "discount_value", "label": "Discount value", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "amount_saved", "label": "Amount saved", "type": "number", "required": true, "review_if_low_confidence": false }
      ] } },

    { "key": "endorsements", "label": "Endorsements", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "endorsement_code", "label": "Endorsement code", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "title", "label": "Title", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "vehicle_id_ref", "label": "Vehicle ID (if vehicle-specific)", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "other_charges", "label": "Other charges", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "charge_name", "label": "Charge name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "amount", "label": "Amount", "type": "number", "required": true, "review_if_low_confidence": false },
        { "key": "vehicle_id_ref", "label": "Vehicle ID (if vehicle-specific)", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "insurance_cards", "label": "Proof-of-insurance ID cards", "type": "array", "required": false, "review_if_low_confidence": false,
      "description": "Real policies typically print one ID card per vehicle. policyNumber/naicCode/effectiveDate/expirationDate/agentPhone/companyName are intentionally not repeated here — they don't vary per card and are already captured at the policy level above.",
      "items": { "type": "object", "properties": [
        { "key": "vehicle_id_ref", "label": "Vehicle ID this card is for", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "insured_name", "label": "Insured name as printed on card", "type": "string", "required": false, "review_if_low_confidence": false, "description": "The card's own display name — may differ from structured named_insureds records (e.g. \"John & Jane Smith\")" },
        { "key": "vehicle_description", "label": "Vehicle description as printed on card", "type": "string", "required": false, "review_if_low_confidence": false, "description": "e.g. \"2023 Ford Mustang\" — single-line, as printed" },
        { "key": "disclaimer_text", "label": "Disclaimer text", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

4. **Added `group` tags** to every scalar field (`policy`, `agent`, `premium`, `coverage`) for the accordion review UI — see §1. Arrays remain their own implicit group (no tag needed).

---

## 4. Comprehensive schemas for the other 8 types

Same philosophy as `auto_policy` above, including `group` tags for the accordion UI: arrays for genuinely repeating entities, flattened-prefixed + grouped fields for singular groupings.

| Type | Top-level fields | Arrays |
|---|---|---|
| `home_policy` | 53 | 4 |
| `life_insurance` | 28 | 3 |
| `warranty` | 22 | 2 |
| `receipt` | 27 | 1 |
| `umbrella_policy` | 24 | 4 |
| `landlord_policy` | 44 | 4 |
| `renters_policy` | 34 | 3 |
| `long_term_care` | 25 | 3 |

### `home_policy.v1.json`

Coverage A–F modeled with explicit limit+premium pairs (matches real HOI declarations layout). `mortgagees[]` is an array since a property can have a first mortgage + HELOC simultaneously. Groups: policy, agent, property, coverage, deductibles, premium.

```json
{
  "schema_version": "home_policy.v1",
  "document_type": "home_policy",
  "description": "Comprehensive homeowners insurance declarations extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier / underwriting company", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "billing_account_number", "label": "Billing account number", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","CANCELLED","PENDING","EXPIRED"] },

    { "key": "form_type", "label": "Form type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["HO-1","HO-2","HO-3","HO-4","HO-5","HO-6","HO-7","HO-8"] },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / expiration date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "term_months", "label": "Term length (months)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": [6,12] },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "property_address_street1", "label": "Property address line 1", "type": "string", "required": true, "review_if_low_confidence": true, "group": "property" },

    { "key": "property_address_street2", "label": "Property address line 2", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "property_address_city", "label": "Property city", "type": "string", "required": true, "review_if_low_confidence": false, "group": "property" },

    { "key": "property_address_state", "label": "Property state", "type": "string", "required": true, "review_if_low_confidence": false, "group": "property" },

    { "key": "property_address_postal_code", "label": "Property postal code", "type": "string", "required": true, "review_if_low_confidence": false, "group": "property" },

    { "key": "year_built", "label": "Year built", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "construction_type", "label": "Construction type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "roof_type", "label": "Roof type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "roof_age_years", "label": "Roof age (years)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "square_footage", "label": "Square footage", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "number_of_stories", "label": "Number of stories", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "occupancy_type", "label": "Occupancy type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property", "enum": ["OWNER_OCCUPIED","TENANT_OCCUPIED","SEASONAL","VACANT"] },

    { "key": "protection_class", "label": "Protection class", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "dwelling_coverage_a_limit", "label": "Dwelling (Coverage A) limit", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "dwelling_coverage_a_premium", "label": "Dwelling (Coverage A) premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "other_structures_coverage_b_limit", "label": "Other structures (Coverage B) limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "other_structures_coverage_b_premium", "label": "Other structures (Coverage B) premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "personal_property_coverage_c_limit", "label": "Personal property (Coverage C) limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "personal_property_coverage_c_premium", "label": "Personal property (Coverage C) premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "loss_of_use_coverage_d_limit", "label": "Loss of use (Coverage D) limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "loss_of_use_coverage_d_premium", "label": "Loss of use (Coverage D) premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "personal_liability_coverage_e_limit", "label": "Personal liability (Coverage E) limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "personal_liability_coverage_e_premium", "label": "Personal liability (Coverage E) premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "medical_payments_coverage_f_limit", "label": "Medical payments (Coverage F) limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "medical_payments_coverage_f_premium", "label": "Medical payments (Coverage F) premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "all_peril_deductible", "label": "All-peril deductible", "type": "number", "required": false, "review_if_low_confidence": true, "group": "deductibles" },

    { "key": "wind_hail_deductible", "label": "Wind / hail deductible", "type": "number", "required": false, "review_if_low_confidence": false, "group": "deductibles" },

    { "key": "hurricane_deductible", "label": "Hurricane deductible", "type": "number", "required": false, "review_if_low_confidence": false, "group": "deductibles" },

    { "key": "earthquake_deductible", "label": "Earthquake deductible", "type": "number", "required": false, "review_if_low_confidence": false, "group": "deductibles" },

    { "key": "gross_premium", "label": "Gross premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "total_discounts_amount", "label": "Total discounts", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "premium_annual", "label": "Total policy premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "fees_and_surcharges", "label": "Fees and surcharges", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "named_insureds", "label": "Named insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "middle_name", "label": "Middle name", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "suffix", "label": "Suffix", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_named_insured", "label": "Primary named insured", "type": "boolean", "required": true, "review_if_low_confidence": false },
        { "key": "email", "label": "Email", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "phone", "label": "Phone", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street1", "label": "Address line 1", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street2", "label": "Address line 2", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_city", "label": "City", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_state", "label": "State", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_postal_code", "label": "Postal code", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "mortgagees", "label": "Mortgagees / lienholders", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "mortgagee_name", "label": "Mortgagee / lienholder name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "mortgagee_address", "label": "Mortgagee address", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "loan_number", "label": "Loan number", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "loan_type", "label": "Loan type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["FIRST_MORTGAGE","SECOND_MORTGAGE","HELOC","OTHER"] }
      ] } },

    { "key": "endorsements", "label": "Endorsements", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "endorsement_code", "label": "Endorsement code", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "title", "label": "Title", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "discounts", "label": "Discounts applied", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "discount_code", "label": "Discount code", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "discount_name", "label": "Discount name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["POLICY","VEHICLE","DRIVER","TELEMATICS"] },
        { "key": "target_id_ref", "label": "Target ID (vehicle/driver)", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "discount_type", "label": "Discount type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["PERCENTAGE","FLAT_AMOUNT"] },
        { "key": "discount_value", "label": "Discount value", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "amount_saved", "label": "Amount saved", "type": "number", "required": true, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

---

### `life_insurance.v1.json`

`insureds[]` (not a single field) to support joint/second-to-die policies. `beneficiaries[]` and `riders[]` are genuinely repeating. Groups: policy, agent, coverage, premium, underwriting.

```json
{
  "schema_version": "life_insurance.v1",
  "document_type": "life_insurance",
  "description": "Comprehensive life insurance policy extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","LAPSED","CANCELLED","PAID_UP"] },

    { "key": "policy_type", "label": "Policy type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["TERM","WHOLE","UNIVERSAL","VARIABLE","VARIABLE_UNIVERSAL"] },

    { "key": "issue_date", "label": "Issue date", "type": "date", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / term end date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "coverage_amount", "label": "Death benefit / face amount", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "cash_value", "label": "Cash value", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "cash_value_as_of_date", "label": "Cash value as of", "type": "date", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "premium_annual", "label": "Annual premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "premium_mode", "label": "Premium mode", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium", "enum": ["ANNUAL","SEMI_ANNUAL","QUARTERLY","MONTHLY"] },

    { "key": "premium_term", "label": "Premium term", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "grace_period_days", "label": "Grace period (days)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "risk_class", "label": "Risk class", "type": "string", "required": false, "review_if_low_confidence": false, "group": "underwriting" },

    { "key": "tobacco_status", "label": "Tobacco status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "underwriting", "enum": ["TOBACCO","NON_TOBACCO","UNKNOWN"] },

    { "key": "rating_table", "label": "Rating table", "type": "string", "required": false, "review_if_low_confidence": false, "group": "underwriting" },

    { "key": "insureds", "label": "Insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "dob", "label": "Date of birth", "type": "date", "required": false, "review_if_low_confidence": false },
        { "key": "gender", "label": "Gender", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_insured", "label": "Primary insured", "type": "boolean", "required": true, "review_if_low_confidence": false },
        { "key": "relationship_to_primary", "label": "Relationship to primary insured", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["SELF","SPOUSE","OTHER"] }
      ] } },

    { "key": "beneficiaries", "label": "Beneficiaries", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "beneficiary_id", "label": "Beneficiary ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "name", "label": "Name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "relationship", "label": "Relationship", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "beneficiary_type", "label": "Beneficiary type", "type": "string", "required": true, "review_if_low_confidence": false, "enum": ["PRIMARY","CONTINGENT"] },
        { "key": "percentage", "label": "Percentage", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "riders", "label": "Riders", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "rider_code", "label": "Rider code", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "title", "label": "Title", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

---

### `warranty.v1.json`

Smaller surface — warranties don't have the multi-vehicle/multi-insured complexity of insurance policies. `covered_components`/`exclusions` are scalar-string arrays. Groups: provider, purchase, product, coverage.

```json
{
  "schema_version": "warranty.v1",
  "document_type": "warranty",
  "description": "Comprehensive product/home warranty extraction fields",
  "fields": [
    { "key": "provider", "label": "Warranty provider / issuer", "type": "string", "required": true, "review_if_low_confidence": true, "group": "provider" },

    { "key": "contract_number", "label": "Contract / warranty number", "type": "string", "required": false, "review_if_low_confidence": true, "group": "provider" },

    { "key": "provider_phone", "label": "Provider phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "provider" },

    { "key": "claim_phone", "label": "Claims phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "provider" },

    { "key": "retailer_name", "label": "Retailer / seller", "type": "string", "required": false, "review_if_low_confidence": false, "group": "purchase" },

    { "key": "retailer_address", "label": "Retailer address", "type": "string", "required": false, "review_if_low_confidence": false, "group": "purchase" },

    { "key": "purchase_order_number", "label": "Purchase order number", "type": "string", "required": false, "review_if_low_confidence": false, "group": "purchase" },

    { "key": "purchase_date", "label": "Purchase date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "purchase" },

    { "key": "purchase_price", "label": "Purchase or contract price", "type": "number", "required": false, "review_if_low_confidence": false, "group": "purchase" },

    { "key": "product_name", "label": "Product or property covered", "type": "string", "required": false, "review_if_low_confidence": true, "group": "product" },

    { "key": "brand", "label": "Brand / manufacturer", "type": "string", "required": false, "review_if_low_confidence": false, "group": "product" },

    { "key": "model", "label": "Model", "type": "string", "required": false, "review_if_low_confidence": false, "group": "product" },

    { "key": "serial_number", "label": "Serial number", "type": "string", "required": false, "review_if_low_confidence": false, "group": "product" },

    { "key": "category", "label": "Product category", "type": "string", "required": false, "review_if_low_confidence": false, "group": "product" },

    { "key": "coverage_start", "label": "Coverage start date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "coverage_end", "label": "Coverage end / expiry date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "coverage_summary", "label": "What is covered (short)", "type": "string", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "deductible", "label": "Service deductible / fee", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "transferable", "label": "Transferable to new owner", "type": "boolean", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "coverage", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "covered_components", "label": "Covered components", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "string" } },

    { "key": "exclusions", "label": "Exclusions", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "string" } }
  ],
  "denormalized_columns": {"party_name":"provider","reference_id":"contract_number","amount":"purchase_price","key_date":"coverage_end","amount_frequency":"amount_frequency"}
}
```

---

### `receipt.v1.json`

Only one real array (`line_items[]`) — a receipt is inherently single-transaction, single-merchant. Groups: merchant, transaction, totals, returns.

```json
{
  "schema_version": "receipt.v1",
  "document_type": "receipt",
  "description": "Comprehensive receipt / invoice extraction fields",
  "fields": [
    { "key": "merchant", "label": "Merchant / store", "type": "string", "required": true, "review_if_low_confidence": true, "group": "merchant" },

    { "key": "merchant_address_street1", "label": "Merchant address", "type": "string", "required": false, "review_if_low_confidence": false, "group": "merchant" },

    { "key": "merchant_address_city", "label": "Merchant city", "type": "string", "required": false, "review_if_low_confidence": false, "group": "merchant" },

    { "key": "merchant_address_state", "label": "Merchant state", "type": "string", "required": false, "review_if_low_confidence": false, "group": "merchant" },

    { "key": "merchant_address_postal_code", "label": "Merchant postal code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "merchant" },

    { "key": "merchant_phone", "label": "Merchant phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "merchant" },

    { "key": "merchant_website", "label": "Merchant website", "type": "string", "required": false, "review_if_low_confidence": false, "group": "merchant" },

    { "key": "receipt_number", "label": "Receipt / invoice number", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "order_number", "label": "Order number", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "purchase_date", "label": "Purchase date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "transaction" },

    { "key": "purchase_time", "label": "Purchase time", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "payment_method", "label": "Payment method", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "card_last_four", "label": "Card last 4 digits", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "cashier_id", "label": "Cashier ID", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "register_id", "label": "Register / terminal ID", "type": "string", "required": false, "review_if_low_confidence": false, "group": "transaction" },

    { "key": "subtotal", "label": "Subtotal", "type": "number", "required": false, "review_if_low_confidence": false, "group": "totals" },

    { "key": "tax_amount", "label": "Tax amount", "type": "number", "required": false, "review_if_low_confidence": false, "group": "totals" },

    { "key": "tax_rate", "label": "Tax rate", "type": "number", "required": false, "review_if_low_confidence": false, "group": "totals" },

    { "key": "tip_amount", "label": "Tip amount", "type": "number", "required": false, "review_if_low_confidence": false, "group": "totals" },

    { "key": "discount_amount", "label": "Discount amount", "type": "number", "required": false, "review_if_low_confidence": false, "group": "totals" },

    { "key": "total_amount", "label": "Total amount", "type": "number", "required": true, "review_if_low_confidence": true, "group": "totals" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "totals" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "totals", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "warranty_hint", "label": "Warranty mentioned on receipt", "type": "string", "required": false, "review_if_low_confidence": false, "group": "returns" },

    { "key": "return_by_date", "label": "Return / exchange by date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "returns" },

    { "key": "return_policy_summary", "label": "Return policy summary", "type": "string", "required": false, "review_if_low_confidence": false, "group": "returns" },

    { "key": "line_items", "label": "Line items", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "line_item_id", "label": "Line item ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "sku", "label": "SKU", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "quantity", "label": "Quantity", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "unit_price", "label": "Unit price", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "line_total", "label": "Line total", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"merchant","reference_id":"receipt_number","amount":"total_amount","key_date":"return_by_date","amount_frequency":"amount_frequency"}
}
```

---

### `umbrella_policy.v1.json`

`underlying_policies[]` replaces the original flat `underlying_auto_policy_number`/`underlying_home_policy_number` pair — an umbrella can sit on top of more than two underlying policies. Groups: policy, agent, coverage, premium.

```json
{
  "schema_version": "umbrella_policy.v1",
  "document_type": "umbrella_policy",
  "description": "Comprehensive personal umbrella / excess liability policy extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","CANCELLED","PENDING","EXPIRED"] },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / expiration date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "term_months", "label": "Term length (months)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": [6,12] },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "coverage_limit", "label": "Umbrella coverage limit", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "self_insured_retention", "label": "Self-insured retention (SIR)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "gross_premium", "label": "Gross premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "total_discounts_amount", "label": "Total discounts", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "premium_annual", "label": "Total policy premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "fees_and_surcharges", "label": "Fees and surcharges", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "named_insureds", "label": "Named insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "middle_name", "label": "Middle name", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "suffix", "label": "Suffix", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_named_insured", "label": "Primary named insured", "type": "boolean", "required": true, "review_if_low_confidence": false },
        { "key": "email", "label": "Email", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "phone", "label": "Phone", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street1", "label": "Address line 1", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street2", "label": "Address line 2", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_city", "label": "City", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_state", "label": "State", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_postal_code", "label": "Postal code", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "underlying_policies", "label": "Underlying policies", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "policy_type", "label": "Underlying policy type", "type": "string", "required": true, "review_if_low_confidence": false, "enum": ["AUTO","HOME","WATERCRAFT","RENTERS","LANDLORD","OTHER"] },
        { "key": "carrier", "label": "Underlying carrier", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "policy_number", "label": "Underlying policy number", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "required_limit", "label": "Required underlying limit", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "discounts", "label": "Discounts applied", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "discount_code", "label": "Discount code", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "discount_name", "label": "Discount name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["POLICY","VEHICLE","DRIVER","TELEMATICS"] },
        { "key": "target_id_ref", "label": "Target ID (vehicle/driver)", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "discount_type", "label": "Discount type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["PERCENTAGE","FLAT_AMOUNT"] },
        { "key": "discount_value", "label": "Discount value", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "amount_saved", "label": "Amount saved", "type": "number", "required": true, "review_if_low_confidence": false }
      ] } },

    { "key": "endorsements", "label": "Endorsements", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "endorsement_code", "label": "Endorsement code", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "title", "label": "Title", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

---

### `landlord_policy.v1.json`

Mirrors `home_policy`'s structure closely (same property/coverage/mortgagee shape) since it's the same underlying declarations-page format, just for a non-owner-occupied property. Groups: policy, agent, property, coverage, deductibles, premium.

```json
{
  "schema_version": "landlord_policy.v1",
  "document_type": "landlord_policy",
  "description": "Comprehensive landlord / rental dwelling insurance policy extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","CANCELLED","PENDING","EXPIRED"] },

    { "key": "form_type", "label": "Form type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["DP-1","DP-2","DP-3"] },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / expiration date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "term_months", "label": "Term length (months)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": [6,12] },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "property_address_street1", "label": "Rental property address line 1", "type": "string", "required": true, "review_if_low_confidence": true, "group": "property" },

    { "key": "property_address_street2", "label": "Rental property address line 2", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "property_address_city", "label": "Property city", "type": "string", "required": true, "review_if_low_confidence": false, "group": "property" },

    { "key": "property_address_state", "label": "Property state", "type": "string", "required": true, "review_if_low_confidence": false, "group": "property" },

    { "key": "property_address_postal_code", "label": "Property postal code", "type": "string", "required": true, "review_if_low_confidence": false, "group": "property" },

    { "key": "unit_count", "label": "Number of units", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "year_built", "label": "Year built", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "construction_type", "label": "Construction type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "roof_type", "label": "Roof type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "square_footage", "label": "Square footage", "type": "number", "required": false, "review_if_low_confidence": false, "group": "property" },

    { "key": "occupancy_type", "label": "Occupancy type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "property", "enum": ["TENANT_OCCUPIED","VACANT","SEASONAL_RENTAL"] },

    { "key": "dwelling_coverage_limit", "label": "Dwelling coverage limit", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "dwelling_coverage_premium", "label": "Dwelling coverage premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "other_structures_coverage_limit", "label": "Other structures coverage limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "loss_of_rents_coverage_limit", "label": "Loss of rents coverage limit", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "loss_of_rents_coverage_premium", "label": "Loss of rents coverage premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "liability_coverage_limit", "label": "Liability coverage limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "liability_coverage_premium", "label": "Liability coverage premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "medical_payments_coverage_limit", "label": "Medical payments coverage limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "all_peril_deductible", "label": "All-peril deductible", "type": "number", "required": false, "review_if_low_confidence": true, "group": "deductibles" },

    { "key": "wind_hail_deductible", "label": "Wind / hail deductible", "type": "number", "required": false, "review_if_low_confidence": false, "group": "deductibles" },

    { "key": "gross_premium", "label": "Gross premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "total_discounts_amount", "label": "Total discounts", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "premium_annual", "label": "Total policy premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "fees_and_surcharges", "label": "Fees and surcharges", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "named_insureds", "label": "Named insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "middle_name", "label": "Middle name", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "suffix", "label": "Suffix", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_named_insured", "label": "Primary named insured", "type": "boolean", "required": true, "review_if_low_confidence": false },
        { "key": "email", "label": "Email", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "phone", "label": "Phone", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street1", "label": "Address line 1", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street2", "label": "Address line 2", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_city", "label": "City", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_state", "label": "State", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_postal_code", "label": "Postal code", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "mortgagees", "label": "Mortgagees / lienholders", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "mortgagee_name", "label": "Mortgagee / lienholder name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "mortgagee_address", "label": "Mortgagee address", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "loan_number", "label": "Loan number", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "loan_type", "label": "Loan type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["FIRST_MORTGAGE","SECOND_MORTGAGE","HELOC","OTHER"] }
      ] } },

    { "key": "endorsements", "label": "Endorsements", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "endorsement_code", "label": "Endorsement code", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "title", "label": "Title", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "discounts", "label": "Discounts applied", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "discount_code", "label": "Discount code", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "discount_name", "label": "Discount name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["POLICY","VEHICLE","DRIVER","TELEMATICS"] },
        { "key": "target_id_ref", "label": "Target ID (vehicle/driver)", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "discount_type", "label": "Discount type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["PERCENTAGE","FLAT_AMOUNT"] },
        { "key": "discount_value", "label": "Discount value", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "amount_saved", "label": "Amount saved", "type": "number", "required": true, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

---

### `renters_policy.v1.json`

`scheduled_items[]` for appraised personal property (jewelry, electronics) — a real HO-4 concept not present in the other property types at this depth. Groups: policy, agent, rental, coverage, premium.

```json
{
  "schema_version": "renters_policy.v1",
  "document_type": "renters_policy",
  "description": "Comprehensive renters / tenant insurance policy extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","CANCELLED","PENDING","EXPIRED"] },

    { "key": "form_type", "label": "Form type", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["HO-4"] },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / expiration date", "type": "date", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "term_months", "label": "Term length (months)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": [6,12] },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "rental_address_street1", "label": "Rental address line 1", "type": "string", "required": true, "review_if_low_confidence": true, "group": "rental" },

    { "key": "rental_address_street2", "label": "Rental address line 2", "type": "string", "required": false, "review_if_low_confidence": false, "group": "rental" },

    { "key": "rental_address_city", "label": "Rental city", "type": "string", "required": true, "review_if_low_confidence": false, "group": "rental" },

    { "key": "rental_address_state", "label": "Rental state", "type": "string", "required": true, "review_if_low_confidence": false, "group": "rental" },

    { "key": "rental_address_postal_code", "label": "Rental postal code", "type": "string", "required": true, "review_if_low_confidence": false, "group": "rental" },

    { "key": "personal_property_coverage_limit", "label": "Personal property coverage limit", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "personal_property_coverage_premium", "label": "Personal property coverage premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "liability_coverage_limit", "label": "Liability coverage limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "liability_coverage_premium", "label": "Liability coverage premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "loss_of_use_coverage_limit", "label": "Loss of use coverage limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "medical_payments_coverage_limit", "label": "Medical payments coverage limit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "coverage" },

    { "key": "deductible", "label": "Deductible", "type": "number", "required": false, "review_if_low_confidence": true, "group": "coverage" },

    { "key": "gross_premium", "label": "Gross premium", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "total_discounts_amount", "label": "Total discounts", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "premium_annual", "label": "Total policy premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "fees_and_surcharges", "label": "Fees and surcharges", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "named_insureds", "label": "Named insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "middle_name", "label": "Middle name", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "suffix", "label": "Suffix", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_named_insured", "label": "Primary named insured", "type": "boolean", "required": true, "review_if_low_confidence": false },
        { "key": "email", "label": "Email", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "phone", "label": "Phone", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street1", "label": "Address line 1", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_street2", "label": "Address line 2", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_city", "label": "City", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_state", "label": "State", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "address_postal_code", "label": "Postal code", "type": "string", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "scheduled_items", "label": "Scheduled personal property", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "item_id", "label": "Item ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["JEWELRY","ELECTRONICS","ART","COLLECTIBLES","MUSICAL_INSTRUMENT","OTHER"] },
        { "key": "appraised_value", "label": "Appraised value", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } },

    { "key": "discounts", "label": "Discounts applied", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "discount_code", "label": "Discount code", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "discount_name", "label": "Discount name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "category", "label": "Category", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["POLICY","VEHICLE","DRIVER","TELEMATICS"] },
        { "key": "target_id_ref", "label": "Target ID (vehicle/driver)", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "discount_type", "label": "Discount type", "type": "string", "required": false, "review_if_low_confidence": false, "enum": ["PERCENTAGE","FLAT_AMOUNT"] },
        { "key": "discount_value", "label": "Discount value", "type": "number", "required": false, "review_if_low_confidence": false },
        { "key": "amount_saved", "label": "Amount saved", "type": "number", "required": true, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

---

### `long_term_care.v1.json`

`care_types_covered[]` is a scalar-string array rather than an object array — there's no per-care-type sub-data worth structuring. Groups: policy, agent, benefits, premium.

```json
{
  "schema_version": "long_term_care.v1",
  "document_type": "long_term_care",
  "description": "Comprehensive long-term care insurance policy extraction fields",
  "fields": [
    { "key": "carrier", "label": "Carrier", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "policy_number", "label": "Policy number", "type": "string", "required": true, "review_if_low_confidence": true, "group": "policy" },

    { "key": "naic_code", "label": "NAIC code", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "policy_status", "label": "Policy status", "type": "string", "required": false, "review_if_low_confidence": false, "group": "policy", "enum": ["ACTIVE","LAPSED","CANCELLED","PAID_UP"] },

    { "key": "issue_date", "label": "Issue date", "type": "date", "required": false, "review_if_low_confidence": false, "group": "policy" },

    { "key": "effective_date", "label": "Effective date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "renewal_date", "label": "Renewal / premium due date", "type": "date", "required": false, "review_if_low_confidence": true, "group": "policy" },

    { "key": "agent_name", "label": "Agent name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agency_name", "label": "Agency name", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_phone", "label": "Agent phone", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "agent_email", "label": "Agent email", "type": "string", "required": false, "review_if_low_confidence": false, "group": "agent" },

    { "key": "daily_benefit_amount", "label": "Daily benefit amount", "type": "number", "required": false, "review_if_low_confidence": true, "group": "benefits" },

    { "key": "monthly_benefit_amount", "label": "Monthly benefit amount", "type": "number", "required": false, "review_if_low_confidence": false, "group": "benefits" },

    { "key": "benefit_period_years", "label": "Benefit period (years)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "benefits" },

    { "key": "lifetime_maximum_benefit", "label": "Lifetime maximum benefit", "type": "number", "required": false, "review_if_low_confidence": false, "group": "benefits" },

    { "key": "elimination_period_days", "label": "Elimination period (days)", "type": "number", "required": false, "review_if_low_confidence": false, "group": "benefits" },

    { "key": "premium_annual", "label": "Annual premium", "type": "number", "required": false, "review_if_low_confidence": true, "group": "premium" },

    { "key": "premium_mode", "label": "Premium mode", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium", "enum": ["ANNUAL","SEMI_ANNUAL","QUARTERLY","MONTHLY"] },

    { "key": "guaranteed_renewable", "label": "Guaranteed renewable", "type": "boolean", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "net_amount_due", "label": "Net amount due", "type": "number", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "currency", "label": "Currency", "type": "string", "required": false, "review_if_low_confidence": false, "group": "premium" },

    { "key": "amount_frequency", "label": "Amount frequency", "type": "string", "required": false, "review_if_low_confidence": true, "group": "premium", "enum": ["one_time","monthly","quarterly","semi_annual","annual","unknown"] },

    { "key": "insureds", "label": "Insureds", "type": "array", "required": true, "review_if_low_confidence": true,
      "items": { "type": "object", "properties": [
        { "key": "insured_id", "label": "Insured ID", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "first_name", "label": "First name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "last_name", "label": "Last name", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "dob", "label": "Date of birth", "type": "date", "required": false, "review_if_low_confidence": false },
        { "key": "is_primary_insured", "label": "Primary insured", "type": "boolean", "required": true, "review_if_low_confidence": false }
      ] } },

    { "key": "care_types_covered", "label": "Care types covered", "type": "array", "required": false, "review_if_low_confidence": false,
      "description": "e.g. HOME_CARE, ASSISTED_LIVING, NURSING_HOME, ADULT_DAY_CARE",
      "items": { "type": "string" } },

    { "key": "riders", "label": "Riders", "type": "array", "required": false, "review_if_low_confidence": false,
      "items": { "type": "object", "properties": [
        { "key": "rider_code", "label": "Rider code", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "title", "label": "Title", "type": "string", "required": true, "review_if_low_confidence": false },
        { "key": "description", "label": "Description", "type": "string", "required": false, "review_if_low_confidence": false },
        { "key": "premium", "label": "Premium", "type": "number", "required": false, "review_if_low_confidence": false }
      ] } }
  ],
  "denormalized_columns": {"party_name":"carrier","reference_id":"policy_number","amount":"premium_annual","key_date":"renewal_date","amount_frequency":"amount_frequency"}
}
```

---

## 5. `design/document-type-modules.md` — document the array field convention

Add a short section describing the `array` field type (scalar items vs. flat-object items, one level of nesting only) as part of the module contract, so future type additions follow the same pattern instead of reinventing nesting depth per type. **Explicitly extend the existing "no type-specific conditionals" rule (rule 1) to the review UI, not just core services** — otherwise the `group` metadata is documented as data but nothing stops a future implementation from hardcoding a section list per document type anyway, defeating the point of tagging fields generically in the first place.

Add as a new rule under "Rules for agents":
```markdown
5. The review UI renders sections generically from the schema — one collapsible section per distinct `group` value among scalar fields, plus one per array field (using the array's own `label`, item count as a badge). **No document-type-specific section list in UI code.** Adding a field to a new or existing `group`, or adding a new array field, must change the rendered UI automatically with zero UI code changes — the same "registry dispatch only" rule that already applies to core services (rule 1) applies here too.
```

---

## 6. `ux_spec.md` — update "Extraction result card" (currently stale/flat)

The current "Extraction result card" entry (§3) predates the array/group convention and just says "Field label + value" — implying one flat list, which doesn't scale to schemas with 25–53 fields plus several arrays. Replace it with:

```markdown
### Extraction result card (data-driven, grouped)
- Small "at a glance" summary always visible at the top: party name, key amount, key date — the essentials, no scrolling required
- Remaining fields grouped into **collapsible sections**: one per schema `group` value among scalar fields (e.g. Policy, Agent, Coverage, Premium), plus one per array field (e.g. "Vehicles (2)", "Drivers (1)") — all collapsed by default except the summary
- **The section list is entirely driven by the document type's schema** (`design/schemas/{type}.v1.json`) — never hardcoded per document type in UI code; see `document-type-modules.md` rule 5
- Array sections render one card per item (e.g. one card per vehicle), reusing the same field label + value + confidence pattern as scalar fields
- Field label + value + confidence / "review suggested" when low, same as before
- Edit control for critical fields
```

---

## Open questions for you

1. **`FieldValue.value` as `oneOf`** — some JSON Schema validators/codegen tools handle `oneOf` on a property's type less cleanly than a plain type array. If your tooling around `openapi.yaml` prefers something simpler, I can instead just loosen `value` to `{}` (any type) with a prose description of the shape rules, rather than a strict `oneOf`.
2. Confirm you're good with the **one-level-deep restructuring** (endorsements/other_charges pulled out to policy-level arrays instead of nested inside each vehicle) — it preserves all the same information, just addressed differently (`vehicle_id_ref` instead of physical nesting).
