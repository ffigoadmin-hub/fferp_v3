# 🛒 Purchase Module Analysis & Health Report

> **Date**: February 18, 2026
> **Scope**: Material Requests, Purchase Orders (PO), Work Orders (WO), Vendor Portal
> **Status**: **Transition Phase** (BOI → GM Role Migration)

---

## 1. System Architecture

The Purchase Module operates on two parallel tracks:
1.  **Project-Based Sourcing**: Driven by the Bill of Quantities (BOQ). Engineers raise `material_requests` which are fulfilled by the Purchase Team.
2.  **Direct Procurement**: Standalone `purchase_orders` and `work_orders` for non-project or ad-hoc needs.

### Core Entities & Relationships
```mermaid
graph TD
    Project[Project] --> BOQ[BOQ Item]
    BOQ --> MR[Material Request]
    MR --> VQ[Vendor Quotes]
    VQ --> PO[Purchase Order]
    PO --> VP[Vendor Portal (Public)]
    PO --> PAY[Payment Request]
    
    subgraph Approval Chain
    MR --> GM[GM Verification]
    GM --> ADMIN[Admin Validation]
    ADMIN --> CEO[CEO Approval]
    end
```

---

## 2. Critical Workflow Update (BOI → GM)

**Migration**: `20260214_replace_boi_with_gm.sql`
The system is actively migrating verification responsibility from the **Board of Intelligence (BOI)** to the **General Manager (GM)**.

| Stage | Old Owner | **New Owner** | Database Column |
| :--- | :--- | :--- | :--- |
| **Verification** | BOI | **GM** | `gm_verified_by` / `gm_verified_at` |
| **Validation** | Admin | **Admin** | `admin_approved_by` |
| **Approval** | CEO | **CEO** | `ceo_approved_by` |

### ⚠️ Risk Area
Legacy code in `usePurchaseOrders.ts` or `PurchaseDashboard.tsx` may still look for `boi_verified_by`. This must be audited to prevent "zombie" requests that no one can approve.

---

## 3. The Vendor Portal (Security & Access)

**Route**: `/vendor/track/:accessToken`
**Mechanism**: 64-character random hex token stored in `purchase_orders.vendor_access_token`.

### Capabilities
*   **No Auth Required**: Access is purely token-based.
*   **Write Access**: Vendors can update:
    *   `dispatch_status`
    *   `dispatch_date`
    *   `invoice_url` (File Upload)

---

## 4. Automated Triggers

### CEO Approval → Payment Creation
When the CEO approves a `material_request` or `purchase_order`, the system logic (in `useMaterialRequests.ts`) **automatically** creates a corresponding record in `payment_requests`.

**Data Mapping:**
*   `PO Amount` → `Payment Amount`
*   `Vendor Bank Details` → `Payment Beneficiary`

**Potential Failure Point**: If the PO lacks bank details at the time of CEO approval, the generated payment request will require manual intervention by Admin/Accounts to fix.

---

## 5. RLS & Security Posture

*   **Row Level Security**: Enabled on all core tables.
*   **Audit Trail**: Every status change records the `actor_id` and timestamp.
*   **Visibility**:
    *   **Engineers**: Can see only their projects' requests.
    *   **Purchase Team**: Can see all active sourcing requests.
    *   **GM/Admin/CEO**: Full visibility (enforced by `20260218` migration).

---

## 6. Action Items

1.  **Audit UI**: Verify `PurchaseDashboard.tsx` filters for `gm_verified` status instead of `boi_verified`.
2.  **Verify RLS**: Ensure the new `GM` role has the correct `UPDATE` policies on `material_requests` and `purchase_orders`.
3.  **Bank Details Validation**: Add a pre-approval check to ensure POs have valid bank details before allowing CEO approval, preventing "broken" payment requests.

---
