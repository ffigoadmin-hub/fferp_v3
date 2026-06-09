# Directive: Work Order Management SOP

## Goal
Ensure all work orders (WO) follow the strictly defined multi-stage lifecycle for financial integrity and project tracking.

## Lifecycle Stages

### Stage 1: Budget Initiation & Approval
1. **Initiation**: Site Engineer/Manager creates a WO request linked to a **Project**, **Phase**, and **Milestone**.
2. **Details**: Must specify `approved_budget` (from BOQ) and `detailed_scope`.
3. **Approval Chain**:
   - **SMO Approval**: Technical verification.
   - **GMO Approval**: Budget authorization.
4. **Status**: Moves to `pending_vendor_sourcing`.

### Stage 2: Vendor Sourcing & Alignment
1. **Sourcing**: Procurement team identifies vendors and collects quotes.
2. **Alignment**: Procurement team records `negotiated_amount` and vendor bank/UPI details.
3. **Verification**: GM verifies the negotiated terms.
4. **Status**: Moves to `pending_admin` (Verification).

### Stage 3: Final Execution Authorization
1. **Admin Review**: Final check of documentation and vendor details.
2. **CEO Approval**: Ultimate authorization for execution and payment.
3. **Execution**: WO status becomes `in_execution`.

## Verification & Proofs
- **Advance Payment**: Requires signed WO document upload.
- **Execution Proofs**: Daily site updates (photos/videos) must be uploaded to `project_execution_proofs` linked to the WO phase.
- **Final Payment**: Requires verification of completion by the site team.

## Edge Cases
- **Budget Deviation**: If `negotiated_amount > approved_budget`, the deviation must be highlighted and requires explicit justification.
- **Hold**: CEO can put a WO on `ceo_hold` for further investigation.

## Execution Tools
- `src/hooks/useWorkOrders.ts`: Orchestrates database interactions.
- `src/components/work-orders/CreateWorkOrderForm.tsx`: Frontend initiation.
- `src/components/projects/ProjectDetailsDialog.tsx`: Comprehensive tracking for CEO/GM.
