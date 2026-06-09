# IGO GROUP ERP: The Master System Encyclopedia (V2.0)

This is the definitive "inch-by-inch" documentation for the IGO GROUP application. It covers everything from technical architecture to the sub-atomic business logic of every role and screen.

---

## 🏛️ 1. Core Philosophy & Governance
IGO CHAIN ERP is a **Governance Engine** designed for absolute operational transparency.
- **Immutability**: Once a daily log or payment proof is submitted, it is locked.
- **Evidence-First**: No work or expense exists without a valid Proof URL (image/video/PDF).
- **Forensic Auditing**: Every administrative decision is logged with a "Before" and "After" state snapshot in `audit_logs`.

---

## 👥 2. The Detailed Role-Operations Matrix

### 🟢 Employee (The Execution Layer)
*The primary data entry point for the system.*
- **Landing**: `/day-start` (Mandatory location/target check before 10:15 AM).
- **Core Workflow**:
    - **Day Plan**: Define specific tasks and expected outputs for the day.
    - **Hourly Reporting**: 9 discrete slots. Each requires task description + Proof URL. Missing a slot permanently reduces the "Discipline Score."
    - **Payment Request**: Apply for vendor funds. Requires Bill Image + Successive Work Proof Image.
    - **My Tasks**: View and update sub-tasks assigned by Admin/GM.
    - **LOP Reversal**: Request relief from "Loss of Pay" penalties by providing evidence of technical error or site emergency.

### 🔵 HR (The Punctuality Auditor)
*Oversees the biological presence and compliance of the workforce.*
- **HRAttendance**: A daily board of every employee's login time.
    - **Bulk Actions**: HR can select multiple "Pending" logs and mark them "Present" or "Absent" with one click.
- **Selfie Viewing**: Verified visual evidence of an employee's presence at the claimed geo-location.
- **LOP Management**: Monitor auto-triggered deductions based on missed slots or late starts.
- **Leave Approvals**: Final oversight on leave requests after manager acknowledgment.

### 🔴 Admin (The Operations Controller)
*The critical scrub layer between field requests and CEO approvals.*
- **Admin Queue**: The first filter for all Payment/Material requests.
    - **Verification**: Admins check the "Work Proof" image quality. If blurry or invalid, they trigger a "Resubmit" or "Reject."
- **User Management**: 1200+ line module allowing creation, deletion (with DB cleanup), and **Bulk CSV Import** of hundreds of users at once.
- **Project Master**: Create projects, assign verticals (Civil/Agri), and link Managers/Engineers.
- **Task Assignment**: Granular sub-tasking for site engineers, tracked in real-time.
- **System Health**: `FixVerticalsPage` and `RoleManagement` to ensure data integrity across the platform.

### 🟡 CEO / BOI (The Command Core)
*High-level strategic intelligence and final authority.*
- **Command Dashboard**: Real-time "Pulse" of all escalations and criticals.
- **Intelligence Hub**: 
    - **Financial Burn**: Monthly spend trends vs. Projected budgets.
    - **Vendor Risk**: Monitoring concentration to avoid dependence on single suppliers.
    - **Discipline Rankings**: Department-wise performance based on reporting compliance.
- **BOI Dispatch**: The BOI (Business Operations Intelligence) role specifically dispatches site escalations to the correct "Solver" role.

### 🟠 GMO / SMO (The Regional Managers)
*Oversees projects and tickets for specific verticals.*
- **GMO (General Management Office)**: Senior oversight of all region-wide tickets and project execution.
- **SMO (Site Management Office)**: Closer to the ground. Approves BOQs (Bill of Quantities) and site-level material needs.
- **Project Command**: Strategic view of a project, including milestone health and budget vs. actuals.

### �️ Engineering (Site Execution)
*Handles the complex "How" of project delivery.*
- **BOQ Builder**: A complex tool to build material lists from templates. Includes cost-estimation and stock-check logic.
- **Project Execution Dashboard**: 
    - **Gantt Charts**: Visual timeline of project phases.
    - **Milestone Manager**: Tracks "Percentage Complete" of sub-phases (Excavation, Finishing, etc.).
- **Sourcing Dashboard**: Link material needs to vendor procurement cycles.

---

## 🔄 3. "Inch-by-Inch" Workflows Detail

### A. The "Discipline Algorithm"
The system calculates a daily score (0-100) for every employee:
- **33% Punctuality**: Logged in before 10:15 AM?
- **33% Compliance**: Did they fill 8/8 hourly slots?
- **34% Integrity**: Did they provide valid proof for every slot?
*Scores below 70% automatically trigger alerts to HR for LOP consideration.*

### B. The Escalation Promotion Logic
1. **L1 (Site)**: Solver has 2 hours to "Acknowledge" the ticket.
2. **L2 (GM)**: If not resolved in 8 hours, it moves to the GM's "Fire" queue.
3. **L3 (CEO)**: If still open after 24 hours, the CEO receives a "Blast" notification, and it appears on the Command Home Screen.

### C. The Procurement Cycle (The "BOQ to PO" path)
- **Step 1**: Engineer builds a BOQ in `BOQBuilderPage`.
- **Step 2**: SMO/Admin reviews and converts BOQ items into a **Purchase Order (PO)**.
- **Step 3**: Purchase Dept finds vendors.
- **Step 4**: Accounts pays once Proof of Delivery (POD) is uploaded to the Project Inventory.

---

## 🗄️ 4. Sub-Atomic Database Tables

| Table Name | Critical Function |
|:--- |:--- |
| `audit_logs` | Stores JSON diffs (`before_state` / `after_state`) of every payment edit. |
| `client_escalations` | Tracks the timestamp of every "Level Promotion" (L1 → L2 → L3). |
| `hourly_criticals` | High-priority site issues that bypass regular queues. |
| `lop_entries` | Stores the specific "Reason Code" for why pay was deducted. |
| `project_phases` | Tracks the "Work-in-Progress" (WIP) percentage for site Gantt charts. |
| `vendor_performance` | Auto-rates vendors based on delivery speed and price consistency. |

---

## 🧪 5. Automation Brain (Edge Functions)
Located in `/supabase/functions`, these scripts are the "invisible hands" of the ERP:
- **`auto-mark-absent`**: Runs at 11:00 AM. If no `day_start` is found, user is marked "PENDING_ABSENT".
- **`check-sla-breach`**: Runs hourly. Moves tickets from L1 → L2 → L3 based on timestamp delta.
- **`evaluate-compliance`**: Calculates the Final Discipline Score at midnight for the previous day.

---

*This guide provides a total view of the IGO GROUP ecosystem. For new developers/members: every button you build must adhere to the Governance and Auditing rules defined above.*
