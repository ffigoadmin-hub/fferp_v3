# IGO CHAIN — Complete System Reference Document

> **Purpose**: This document is the single authoritative reference for the entire IGO Chain ERP application. It is designed to give an AI assistant (Claude) complete understanding of the system's architecture, data model, business logic, workflows, roles, and codebase structure, enabling it to generate accurate code, answer questions, and implement features correctly.

---

## Table of Contents

1. [System Overview & Philosophy](#1-system-overview--philosophy)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Core Daily Workflow](#6-core-daily-workflow)
7. [Payment System](#7-payment-system)
8. [Escalation & Critical Ticket System](#8-escalation--critical-ticket-system)
9. [Engineering Module](#9-engineering-module)
10. [Farm & Agriculture Module](#10-farm--agriculture-module)
11. [Shift Module](#11-shift-module)
12. [Rental Module](#12-rental-module)
13. [Leave & LOP (Loss of Pay) System](#13-leave--lop-loss-of-pay-system)
14. [Travel & Expense Management](#14-travel--expense-management)
15. [Notifications & Alerts](#15-notifications--alerts)
16. [AI & Intelligence Layer](#16-ai--intelligence-layer)
17. [CEO Command Center](#17-ceo-command-center)
18. [Database Schema](#18-database-schema)
19. [Supabase Edge Functions](#19-supabase-edge-functions)
20. [Mobile Application](#20-mobile-application)
21. [Key Libraries & Utilities](#21-key-libraries--utilities)
22. [Environment & Configuration](#22-environment--configuration)
23. [Coding Conventions & Patterns](#23-coding-conventions--patterns)

---

## 1. System Overview & Philosophy

**IGO Chain** is a real-time, enterprise-grade **Governance Engine** (ERP) built for the **IGO GROUP** — a conglomerate operating across Civil/Construction Engineering, Agriculture, and Supply Chain verticals.

### Core Principles

| Principle | Description |
|:---|:---|
| **Transparency** | Every action is logged. Every approval creates an immutable audit trail. |
| **Immutability** | Once data is submitted (day logs, payment requests, escalations), it is **permanently locked**. No retroactive editing. |
| **Evidence-First (Proof URLs)** | Every claim requires a Google Drive "Proof Folder" with invoices, photos, videos, call recordings, or delivery notes. Fields like `bill_url`, `work_proof_url`, `proof_url`, `evidence_url`, `selfie_url`, `resolution_evidence_url` are pervasive. |
| **Forensic Auditability** | The `audit_logs` table records who did what, when, from where, with before/after state snapshots. Over 20,000 records in production. |
| **Management by Exception** | The CEO only sees items that deviate from plan — escalations, SLA breaches, held payments. |

### Business Verticals

- **Engineering (Civil/Construction)**: Projects, BOQ, Work Orders, Purchase Orders, Material Requests, Site Updates
- **Agriculture (Agri)**: Cultivation Cycles, Daily Farm Logs, Harvest Records, Buy-back
- **Operations**: Payments, Procurement, Vendor Management, Inventory
- **HR & Admin**: Attendance, LOP, Leave, Employee Issues, Announcements, Department Management

---

## 2. Technology Stack

### Frontend (Web)
| Technology | Purpose |
|:---|:---|
| **React 18** | UI framework (functional components, hooks) |
| **Vite** | Build tool and dev server |
| **TypeScript** | Type-safe development throughout |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Component library (Button, Dialog, Sheet, Card, Badge, Tabs, etc.) |
| **React Router DOM v6** | Client-side routing with nested routes |
| **TanStack React Query** | Server state management, caching, real-time data fetching |
| **date-fns** | Date formatting and manipulation |
| **Lucide React** | Icon library |
| **Recharts** | Charts and data visualization |
| **Sonner** | Toast notifications |

### Backend
| Technology | Purpose |
|:---|:---|
| **Supabase** | Backend-as-a-Service (PostgreSQL + Auth + Realtime + Storage + Edge Functions) |
| **PostgreSQL** | Primary database with Row Level Security (RLS) |
| **Supabase Edge Functions** | Serverless Deno-based functions for background logic |
| **Supabase Realtime** | WebSocket subscriptions for live data updates |
| **Supabase Storage** | File uploads (selfies, proofs, documents) |

### Mobile
| Technology | Purpose |
|:---|:---|
| **React Native (Expo)** | Cross-platform mobile application |
| **Expo Router** | File-based routing for mobile screens |

### Key Dev Dependencies
- `@supabase/supabase-js` — Supabase client
- `@tanstack/react-query` — Data fetching & caching
- `clsx` + `tailwind-merge` — Class name utilities (via `cn()` helper in `src/lib/utils.ts`)

---

## 3. Project Structure

```
igochain-main/
├── src/
│   ├── App.tsx                    # Main app with routing, auth, layout
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Global styles & Tailwind config
│   ├── pages/                     # 120+ page directories, organized by role/module
│   │   ├── employee/              # DayStartPage, DayPlanPage, HourlyReportPage, EODSummaryPage
│   │   ├── admin/                 # AdminPaymentsPage, DepartmentManagementPage, UserManagementPage
│   │   ├── ceo/                   # CEODashboardPage, CEOApprovalsPage, CEOIntelligencePage
│   │   ├── hr/                    # HRDashboardPage, AttendanceTrackerPage
│   │   ├── accounts/              # AccountsExecutionPage, ExpenseSheetPage
│   │   ├── engineering/           # EngineerDashboardPage, BOQBuilderPage, ProjectExecutionPage
│   │   ├── escalations/           # ClientEscalationDashboardPage, HourlyCriticalDashboardPage
│   │   ├── shift/                 # ShiftDashboardPage, ShiftLoginPage, ShiftHourlyTrackerPage
│   │   ├── rentals/               # RentalDashboardPage, RentalPaymentsPage
│   │   ├── procurement/           # ProjectProcurementDashboardPage, SourcingDashboardPage
│   │   ├── vendor/                # VendorPortalPage (public, token-based access)
│   │   ├── boi/                   # BOIDashboardPage, BOIPaymentAuditPage
│   │   ├── smo/                   # SMODashboardPage
│   │   ├── gmo/                   # GMODashboardPage, GMOEngineeringTeamPage
│   │   ├── nsm/                   # NSMDashboardPage
│   │   ├── director/              # DirectorPaymentAuditPage
│   │   ├── auditor/               # AuditorPaymentPage
│   │   ├── farm/                  # FarmDashboardPage, CultivationCyclePage
│   │   └── ...
│   ├── components/                # 247+ reusable UI components
│   │   ├── ui/                    # shadcn/ui primitives (button, card, dialog, sheet, tabs, etc.)
│   │   ├── layout/                # TopBar, Sidebar, MobileNav, AppLayout
│   │   ├── payments/              # PaymentCard, PaymentForm, BulkPayments
│   │   ├── escalations/           # EscalationCard, EscalationTimeline
│   │   ├── engineering/           # BOQTable, ProjectCard, PhaseManager
│   │   ├── dashboard/             # Widgets, Charts, KPI cards
│   │   └── ...
│   ├── hooks/                     # 97+ custom React hooks
│   │   ├── usePaymentRequests.ts  # CRUD for payment_requests
│   │   ├── useEscalations.ts      # Client escalation operations
│   │   ├── useCriticals.ts        # Hourly critical operations
│   │   ├── useProjects.ts         # Project CRUD
│   │   ├── useDayStart.ts         # Day start operations
│   │   ├── useHourlyReports.ts    # Hourly report CRUD
│   │   ├── useNotifications.ts    # Notification management
│   │   ├── usePayees.ts           # Payee management (user-scoped)
│   │   ├── useLocationTracking.ts # Periodic GPS tracking
│   │   └── ...
│   ├── types/
│   │   ├── igo-chain.ts           # Core types: UserRole, PaymentStatus, User, DayStart, etc.
│   │   └── workflows.ts          # Escalation/Critical types, SLA helpers, department buckets
│   ├── lib/
│   │   ├── utils.ts               # cn() class merge utility
│   │   ├── slotHelpers.ts         # Time slot management
│   │   ├── slotStatusHelpers.ts   # Slot status computation
│   │   ├── riskEngine.ts          # Payment risk scoring
│   │   ├── pdfParser.ts           # PDF invoice parsing
│   │   ├── exportUtils.ts         # General data export
│   │   ├── expenseSheetExport.ts  # Expense sheet Excel export
│   │   ├── kotakBankExport.ts     # Kotak Bank format payment export
│   │   ├── alertSounds.ts         # Audio alert management
│   │   └── notificationSound.ts   # Notification audio
│   ├── contexts/
│   │   └── AuthContext.tsx         # Authentication provider & useAuth hook
│   └── integrations/
│       └── supabase/
│           ├── client.ts           # Supabase client initialization
│           └── types.ts            # Auto-generated Supabase types
├── supabase/
│   ├── config.toml                # Local dev configuration
│   └── functions/                 # 18+ Edge Functions
│       ├── check-sla-breach/      # SLA breach detection & escalation
│       ├── blast-critical-alerts/ # Critical alert broadcasting
│       ├── evaluate-selfie-compliance/ # Selfie verification
│       ├── erp-intelligence/      # ERP analytics
│       ├── intelligence-analyze/  # Deep analysis
│       ├── auto-mark-absent/      # Auto-absence detection
│       ├── generate-compliance-report/
│       ├── bulk-generate-lop/     # Bulk LOP generation
│       ├── create-user/           # User account creation
│       ├── update-user/           # User profile updates
│       ├── send-notification/     # Push notification dispatch
│       └── ...
├── mobile-app/                    # React Native (Expo) mobile application
│   ├── app/                       # Expo Router screens
│   ├── components/                # Mobile UI components
│   ├── hooks/                     # Mobile-specific hooks
│   └── package.json               # Mobile dependencies
├── docs/                          # Planning and documentation
│   ├── PLAN.md                    # Master development plan
│   ├── PLAN-rental-module-v2.md   # Rental module v2 plan
│   └── ...
├── MASTER_SYSTEM_DOCUMENTATION.md
├── PAYMENT_SYSTEM_SOP.md
├── ENGINEERING_MODULE_DOCUMENTATION.md
├── CEO_EXECUTIVE_SUMMARY.md
├── PROJECT_PRESENTATION.md
└── package.json
```

---

## 4. Authentication & Authorization

### Authentication Flow (`src/contexts/AuthContext.tsx`)

1. **Supabase Auth** handles sign-in/sign-out via `supabase.auth`.
2. On auth state change (`onAuthStateChange`), the app fetches the user's profile from the `profiles` table.
3. The database `role` field is normalized via `mapRole()` which maps variations (e.g., `'data'`, `'dataTeam'`, `'data_team'` → `'datateam'`).
4. A `User` object is constructed with: `id`, `employeeId` (from `office_number`), `name`, `email`, `role`, `department`.
5. **Login events** are recorded in `audit_logs` with action `'USER_LOGIN'`.
6. **Logout events** are recorded with action `'USER_LOGOUT'`.

### AuthContext API

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}
```

### Route Protection (`ProtectedRoute` in App.tsx)

```typescript
<ProtectedRoute allowedRoles={['admin', 'ceo', 'boi']}>
  <SomeProtectedPage />
</ProtectedRoute>
```

- Checks `user.role` against `allowedRoles` (case-insensitive).
- Implements **auto-absent lockout**: After a certain time (e.g., 11:30 AM IST), if the employee hasn't submitted a day start or selfie, they are redirected to `/absent-locked`.
- Handles **manual locks** and **revocations** by admin.
- Checks for **week-off assignments** to bypass attendance requirements.
- Redirects unauthorized users to `/redirect`.

---

## 5. Role-Based Access Control (RBAC)

### All Roles (22 total)

```typescript
type UserRole =
  | 'employee'      // Field workers & office staff
  | 'hr'            // Human Resources — attestations, attendance
  | 'admin'         // System admin — user/dept mgmt, final payment validation
  | 'ceo'           // Top-level approvals, intelligence, strategic oversight
  | 'accounts'      // Payment execution, UTR verification, reconciliation
  | 'gm'            // General Manager — escalation L2, project oversight
  | 'smo'           // Senior Management Operations — first operations approver
  | 'gmo'           // General Manager Operations — second operations approver
  | 'boi'           // Board of Intelligence — key audit/approval checkpoint
  | 'nsm'           // National Sales Manager
  | 'datateam'      // Data Team — creates hourly criticals
  | 'farmmanager'   // Farm operations & cultivation management
  | 'purchase'      // Procurement & sourcing
  | 'vendor'        // External vendor (limited portal access)
  | 'auditor'       // Payment auditor (Farmers Factory workflow)
  | 'director'      // Director — Agri payment approvals
  | 'Director'      // Case variant (legacy)
  | 'bd_data'       // Business Development Data
  | 'rsh'           // Regional Service Head — raises escalations
  | 'sitemanager'   // Site-level project management
  | 'engineering'   // Engineering team member
  | 'data'          // Alias for datateam
```

### Role Hierarchy & Responsibilities

```
CEO ─────────────────────────────────── Strategic decisions, final approvals
 ├─ BOI (Board of Intelligence) ──────── Key audit checkpoint across all workflows
 ├─ GM (General Manager) ─────────────── Escalation L2, Work Order/PO verification
 ├─ Director ─────────────────────────── Agri-specific payment approvals
 │
 ├─ Admin ────────────────────────────── System admin, payment validation, user mgmt
 │   └─ HR ───────────────────────────── Attendance attestation, leave management
 │
 ├─ GMO (GM Operations) ──────────────── Engineering payment audit, team oversight
 │   └─ SMO (Senior Mgmt Ops) ────────── First-line operations approval
 │
 ├─ NSM (National Sales Manager) ─────── Sales dashboard & oversight
 ├─ RSH (Regional Service Head) ──────── Raises escalations from site
 ├─ Accounts ─────────────────────────── Payment execution, UTR entry, bank exports
 ├─ Auditor ──────────────────────────── Farmers Factory payment verification
 ├─ Purchase ─────────────────────────── Procurement, vendor quotes, sourcing
 │
 ├─ Farm Manager ─────────────────────── Cultivation cycles, harvest records
 ├─ Site Manager ─────────────────────── On-site project management
 ├─ Engineering ──────────────────────── BOQ creation, project execution
 ├─ Data Team ────────────────────────── Creates hourly criticals, data ops
 │
 ├─ Employee ─────────────────────────── Daily workflow, hourly reports, payments
 └─ Vendor ───────────────────────────── External: dispatch updates via token portal
```

### Key Route Mappings (from App.tsx)

| Route | Roles | Purpose |
|:---|:---|:---|
| `/day-start` | All authenticated | Morning login with location |
| `/day-plan` | All authenticated | Daily task planning |
| `/hourly-report` | All authenticated | Hourly proof-of-work submission |
| `/eod-summary` | All authenticated | End-of-day wrap-up |
| `/employee-dashboard` | employee | Personal dashboard |
| `/admin-payments` | admin | Payment validation pipeline |
| `/ceo-dashboard` | ceo | Command center |
| `/ceo-approvals` | ceo | Payment & hold approvals |
| `/ceo-intelligence` | ceo | Strategic analytics |
| `/hr-dashboard` | hr | Attendance & HR ops |
| `/accounts-execution` | accounts | Payment disbursement |
| `/boi-dashboard` | boi | Board oversight |
| `/boi-payment-audit` | boi | Payment audit queue |
| `/smo-dashboard` | smo | Ops first-line review |
| `/gmo-dashboard` | gmo | Ops second-line review |
| `/nsm-dashboard` | nsm | Sales oversight |
| `/director-payment-audit` | director | Agri payment approval |
| `/auditor-payments` | auditor | Farmers Factory audit |
| `/engineering-dashboard` | admin, ceo, boi, gmo, smo | Engineering project overview |
| `/boq-builder/:projectId` | admin, ceo, boi, gmo, smo, engineer | Bill of Quantities |
| `/project-execution/:projectId` | admin, ceo, boi, gmo, smo, engineer | Live project tracking |
| `/escalation-dashboard` | Multiple ops roles | Client escalation management |
| `/hourly-critical-dashboard` | Multiple ops roles | Critical issue tracking |
| `/shift-dashboard` | admin, hr, ceo | Shift management |
| `/rental-dashboard` | admin, hr, ceo, rsh, accounts | Rental property management |
| `/vendor/track/:accessToken` | **Public** (no auth) | Vendor dispatch tracking |

---

## 6. Core Daily Workflow

The daily workflow is the **heart of data collection** in IGO Chain. It creates a closed-loop reporting cycle.

### Sequence

```
Morning (by 9:30 AM IST)          Daytime (every hour)           Evening (after 6:30 PM)
┌──────────────────┐    ┌─────────────────────────┐    ┌────────────────────┐
│  1. Day Start    │───►│  3. Hourly Reports      │───►│  4. EOD Summary    │
│  - Location zone │    │  - Task description      │    │  - Planned work    │
│  - Login selfie  │    │  - Proof URL (mandatory) │    │  - Completed work  │
│  - Time verified │    │  - Late tracking         │    │  - Completion %    │
└──────────────────┘    │  - Grace period logic    │    │  - Pending items   │
        │               └─────────────────────────┘    └────────────────────┘
        ▼
┌──────────────────┐
│  2. Day Plan     │
│  - Tasks array   │
│  - Expected output│
│  - Dependencies  │
│  - Is project?   │
└──────────────────┘
```

### Database Tables

| Table | Rows (prod) | Key Fields |
|:---|:---|:---|
| `day_starts` | ~2,095 | `user_id`, `date`, `location_zone` (head_office/back_office/site/other), `login_status` (on_time/late) |
| `day_plans` | ~2,152 | `user_id`, `date`, `tasks[]`, `expected_output`, `is_project_work`, `dependency` |
| `hourly_reports` | ~16,399 | `user_id`, `date`, `time_slot`, `report_text`, `is_late`, `delay_minutes`, `status` (submitted/pending_late_reason/completed) |
| `hourly_plans` | ~11,696 | `user_id`, `date`, `time_slot`, `plan_text`, `status` (always 'locked') |
| `eod_reports` | ~1,931 | `user_id`, `date`, `planned_work`, `completed_work`, `completion_percentage` (0-100), `pending_items` |
| `late_reasons` | 0 | `hourly_report_id`, `delay_reason`, `detailed_explanation`, `proof_url` |
| `extra_work_entries` | ~711 | `user_id`, `date`, `time_slot`, `work_type` (assigned/done), `description`, `proof_url` |
| `selfie_records` | ~1,196 | `user_id`, `date`, `selfie_type`, `selfie_url`, `expires_at` (2 days) |

### Time Slots Configuration

Defined in `src/types/igo-chain.ts` as `TIME_SLOTS`:
- `09:30-10:30`, `10:30-11:30`, `11:30-12:30`, `12:30-13:30`
- `13:30-14:30`, `14:30-15:30`, `15:30-16:30`, `16:30-17:30`
- `17:30-18:30`, `18:30-19:30`

### Discipline Algorithm

Calculates a daily score based on:
1. **Punctuality**: Was the day start on time? Were hourly reports timely?
2. **Compliance**: Were all required slots filled? Were selfies captured?
3. **Integrity**: Proof URLs validated, no gaps in reporting.

Auto-generated LOP (Loss of Pay) is triggered when thresholds are violated. Sources include:
- `SYSTEM_TIME_TRAP` — Late submissions
- `SYSTEM_COMPLIANCE_TRAP` — Missing compliance items
- `SYSTEM_ABSENT` / `SYSTEM_AUTO_MARK_ABSENT` — Failed to log in
- `SYSTEM_SELFIE` / `SYSTEM_SELFIE_LUNCH` / `SYSTEM_SELFIE_EVENING` — Missing selfies
- `HR_ABSENT` — HR-marked absence

---

## 7. Payment System

### Overview

The payment system is the most complex workflow in IGO Chain. It is evidence-based, multi-tier approval with immutability after submission.

### Payment Request Fields (key columns from `payment_requests` table, ~278 records)

| Field | Purpose |
|:---|:---|
| `requester_id` | Who raised it |
| `purpose` | What for |
| `vendor_name` | Payee name |
| `vendor_bank_details` | Bank details text |
| `vendor_account_number`, `vendor_ifsc_code` | Structured bank fields |
| `vendor_upi` | UPI ID if payment_type is 'upi' |
| `payment_type` | 'upi' or 'bank_account' |
| `amount` | Payment amount (numeric) |
| `bill_url` | Invoice/bill proof URL |
| `work_proof_url` | Work completion proof URL |
| `cutoff_date`, `cutoff_time` | Payment deadline |
| `urgency` | 'normal' or 'emergency' |
| `department` | Determines approval workflow |
| `is_petty_cash` | Expedited processing flag |
| `is_porter_payment` | Porter/transport flag with km tracking |
| `project_id`, `phase_id`, `boq_item_id` | Engineering project linkage |
| `work_order_id` | Links to specific work order |
| `tags[]` | Tagging for categorization |
| `payment_number` | Auto-incremented serial |
| `audit_timeline` | JSONB array of all approval actions |
| `bulk_batch_id` | For bulk payment batching |
| `utr_number` | Bank transaction reference (post-payment) |
| `utr_verified_at`, `utr_match_confidence` | UTR verification tracking |

### Payment Status Flow

```typescript
type PaymentStatus =
  | 'pending'          // Initial submission
  | 'smo_audit'        // Awaiting SMO review (Engineering/Agri)
  | 'gmo_audit'        // Awaiting GMO review (Engineering only)
  | 'director_audit'   // Awaiting Director review (Agri only)
  | 'boi_audit'        // Awaiting BOI review (all departments)
  | 'gm_audit'         // Awaiting GM review (Engineering only)
  | 'admin_audit'      // Awaiting Admin validation
  | 'ceo_audit'        // Awaiting CEO approval
  | 'ceo_hold'         // CEO has put on hold with reason
  | 'rejected'         // Rejected at any stage
  | 'paid'             // Disbursed by Accounts
  // Legacy statuses:
  | 'smo_verified'
  | 'gm_approved'
  | 'admin_approved'
  | 'ceo_approved'
```

### Three Approval Workflows (by department)

#### 1. Agri Engineering (7-step)
```
Requester → SMO → GMO → BOI → GM → Admin → CEO → Accounts
```

#### 2. Agricultural (6-step)
```
Requester → SMO → BOI → Director → Admin → CEO → Accounts
```

#### 3. Operational (4-step)
```
Requester → BOI → Admin → CEO → Accounts
```

#### Special: Farmers Factory (with Auditor)
```
Requester → Auditor → Admin → CEO → Accounts
```

#### Petty Cash (Expedited)
```
Requester → Admin → CEO → Accounts (fast-tracked)
```

### Approval Tracking per Role

Each approval step records: `{role}_approved_by` (UUID), `{role}_approved_at` (timestamp), `{role}_rejection_reason` (text).

Roles that record approvals: `smo`, `gmo`, `director`, `boi`, `gm`, `admin`, `ceo`, `auditor`, `accounts`.

### Post-Payment (Accounts Role)
- `accounts_executed_by` — Who processed the payment
- `utr_number` — Unique Transaction Reference from bank
- `payment_proof_url` — Bank confirmation screenshot
- `paid_at` — Timestamp of payment
- Accounts can **reverse** a payment (`accounts_reversed_by`, `accounts_reversal_reason`)

### Bank Export
- `kotakBankExport.ts` — Formats payment data for Kotak Bank bulk upload
- `expenseSheetExport.ts` — Daily expense sheet Excel export

### Related Tables
- `payees` — Saved vendor/payee details (user-scoped via `created_by`)
- `bulk_batches` — Batch payment grouping
- `daily_expense_sheet` — Linked to payment requests
- `work_order_payments` — Payments linked to specific work orders

---

## 8. Escalation & Critical Ticket System

### Two Parallel Systems

| System | Table | Records | SLA Acknowledge | SLA Resolve | Created By |
|:---|:---|:---|:---|:---|:---|
| **Client Escalations** | `client_escalations` | ~235 | 10 minutes | 3 hours | RSH, SMO, Data Team |
| **Hourly Criticals** | `hourly_criticals` | ~167 | 10 minutes | 45 minutes | Data Team |

### Client Escalation Statuses

```typescript
type ClientEscalationStatus =
  | 'open' | 'pending' | 'acknowledged' | 'in_progress'
  | 'grace_period' | 'escalated' | 'escalated_gm' | 'escalated_ceo'
  | 'resolved' | 'closed' | 'pending_closure_approval'
```

### Escalation Layer System

```
Layer 1 (L1) — Site Ops / SMO
    │ (SLA breach or manual escalation)
    ▼
Layer 2 (L2) — GM / GMO
    │ (SLA breach or manual escalation)
    ▼
Layer 3 (L3) — CEO / Admin (Crisis level)
```

Each layer tracks: `assigned_layer_1_id`, `assigned_layer_2_id`, `assigned_layer_3_id` with resolution timestamps.

### Closure Workflow

1. Solver submits **resolution proof** (screenshots, audio, text)
2. Status → `pending_closure_approval`
3. **Admin verifies** the resolution
4. Admin can **approve closure** → `closed` or **reject** with reason → back to solver
5. Closure records: `closure_admin_id`, `closure_verified_at`, `closure_approved_by`

### Escalation Buckets (27 categories)

```typescript
type EscalationBucket =
  | 'eng_jv'              // Engineering Joint Venture
  | 'eng_direct'          // Engineering Direct
  | 'agri_jv'             // Agriculture Joint Venture
  | 'agri_direct'         // Agriculture Direct
  | 'farm_manager'        // Farm Manager issues
  | 'buy_back'            // Buy-back operations
  | 'business_development'// BD issues
  | 'hr'                  // HR issues
  | 'head_office'         // Head office ops
  | 'rental_sourcing'     // Rental department
  | 'tnskill'             // TNSkill unit
  | 'nursery_landscaping' // Nursery & Landscaping
  | 'site_visit'          // Site visit related
  | ... (13 more including farmers_factory, it, logistics, etc.)
```

### Timeline Tables

- `client_escalation_timeline` (~2,316 records) — Every action on an escalation
- `hourly_critical_timeline` (~1,384 records) — Every action on a critical
- Fields: `action`, `performed_by`, `performed_by_name`, `performed_by_role`, `details` (JSONB)

### SLA Helper Functions (workflows.ts)

```typescript
getTimeRemaining(deadline: string): { minutes: number; seconds: number; isOverdue: boolean }
getResolveSLAStatus(createdAt: string, resolvedAt?: string, slaMinutes?: number): SLAResult
getDepartmentInfo(bucket: string): { name: string; color: string; icon: string }
```

---

## 9. Engineering Module

### Project Lifecycle

```
New Deal → Engineering Assigned → BOQ Submitted → BOQ Approved → Sourcing → Execution → Completed
```

Stage tracking: `lifecycle_stage`, `stage_*_at` timestamps for each transition.

### Core Tables

| Table | Records | Purpose |
|:---|:---|:---|
| `projects` | ~89 | Master project record |
| `project_verticals` | ~9 | Vertical categories (DIRECT/JV) |
| `project_phases` | ~2 | Phase breakdown per project |
| `project_boq` | ~4 | Bill of Quantities line items |
| `project_milestones` | — | Phase milestones with completion tracking |
| `project_execution_proofs` | — | Site photos/videos during execution |
| `project_timeline` | — | Audit trail of all project actions |
| `project_inventory` | — | Material inventory at project site |
| `project_variations` | — | BOQ variation/change orders |
| `daily_site_updates` | — | Daily progress reports from site |
| `boq_templates` | — | Reusable BOQ templates |

### Project Key Fields

- `project_id` (human-readable), `project_name`, `client_name`, `client_contact`
- `location_city`, `location_state`, `vertical`, `department` (agri/engineering)
- `project_type` (jv/direct), `project_category` (DIRECT/JV)
- `assigned_manager_id`, `assigned_engineer_id`, `assigned_site_manager_id`, `assigned_project_engineer_id`
- `deal_file_url`, `total_project_value`
- `lifecycle_stage`, `status` (active/upcoming/hold/closed)
- `overall_completion_percentage`

### BOQ (Bill of Quantities)

Line items with: `material_name`, `specification`, `quantity`, `unit`, `estimated_unit_cost`, `actual_unit_cost`
- Category: `material`, `labour`, `equipment`
- Sourcing: linked to `purchase_orders` (PO) or `work_orders` (WO)
- Status: pending → requested → sourced → ordered → delivered → completed

### Work Orders & Purchase Orders

Both follow similar approval flows:
```
Requester → BOI → GM → Admin → CEO
```
- `work_orders` — For labor/service work
- `purchase_orders` — For material purchases
- Both have `boi_verified_by`, `gm_verified_by`, `admin_approved_by`, `ceo_approved_by`
- POs include vendor portal: `vendor_access_token` (UUID) for tracking

### Procurement & Sourcing

- `material_requests` — Requests for materials with multi-level approval (BOI, Admin, CEO)
- `vendor_quotes` — Vendor quotations linked to BOQ items
- `vendor_work_requests` — Work requests sent to vendors
- `vendor_ratings` — Post-delivery vendor ratings
- `procurement_timeline` — Audit trail
- `purchase_progress_logs` — Purchase status updates

---

## 10. Farm & Agriculture Module

### Core Tables

| Table | Purpose |
|:---|:---|
| `cultivation_cycles` | Crop cultivation tracking (project-linked) |
| `daily_farm_logs` | Daily activity reports from farm |
| `harvest_records` | Harvest yield recording |
| `farm_manager_remarks` | Farm manager observations |
| `inventory_usage_logs` | Material/chemical usage at farm |

### Features

- **Cultivation Cycle Management**: Track planting-to-harvest lifecycle
- **Daily Farm Logging**: Photo/video evidence from fields
- **Harvest Recording**: Yield data with quality metrics
- **Inventory Tracking**: Usage of fertilizers, pesticides, equipment
- **Customer Testimonials**: `customer_testimonial_text`, `customer_testimonial_url` on projects

---

## 11. Shift Module

### Overview

For factories and sites operating in shifts.

### Core Tables

| Table | Purpose |
|:---|:---|
| `shift_sessions` | Individual shift login/logout records |
| `shift_user_assignments` | Which users are assigned to which shifts |
| `shift_assignment_history` | Audit trail of shift changes |

### Shift Pages

- `ShiftDashboardPage` — Overview of all shift operations
- `ShiftLoginPage` — Clock in/out
- `ShiftHourlyTrackerPage` — Hourly activity logging during shift
- `ShiftBreakPage` — Break management
- `ShiftEODPage` — Shift-specific EOD reporting

---

## 12. Rental Module

### Overview

Manages rental properties across the organization.

### Features

- **Property Management**: Property listings with categories
- **Rental Payments**: Payment requests with department-specific approval
- **Multi-Role Dashboards**: HR, RSH, Admin, CEO, Accounts views
- **Property Remarks**: `rental_property_remarks` for notes and observations
- **Bulk Operations**: Bulk rental payment raising

### Approval Flow

```
HR → RSH → Admin → CEO → Accounts
```

---

## 13. Leave & LOP (Loss of Pay) System

### Leave Management

**Tables**: `leave_types` (4 types), `leave_requests` (~64 records)

**Leave Request Status Flow**:
```
pending_hr → pending_boi → pending_admin → pending_ceo → approved/rejected
```

- Duration categories: `full`, `half`, `hourly`
- Half-day shifts: `first`, `second`
- Hourly leaves: `start_time`, `end_time`
- Each level reviews with `{role}_reviewed_by`, `{role}_reviewed_at`, `{role}_remarks`

### LOP (Loss of Pay) System

**Table**: `lop_entries` (~483 records)

**LOP Types**: `1_day`, `0.5_day`, `0.25_day`, `0.1_day`

**LOP Sources** (automated vs manual):
- `manual` — HR/Admin manually created
- `SYSTEM_TIME_TRAP` — System detected time violation
- `SYSTEM_COMPLIANCE_TRAP` — Compliance failure
- `SYSTEM_ABSENT` / `SYSTEM_AUTO_MARK_ABSENT` — Auto-absence
- `SYSTEM_SELFIE*` — Missing selfies (lunch, evening)
- `SYSTEM_REPORTS` — Missing report submissions
- `HR_ABSENT` — HR marked absent

**LOP Approval Status Flow**:
```
pending_admin → pending_ceo → approved/rejected
```

Or with BOI:
```
pending_boi → pending_admin → pending_ceo → approved/rejected
```

### LOP Reversal System

Employees can request reversal of LOPs:
```
Employee Request → REV_PENDING_BOI → REV_PENDING_ADMIN → REV_PENDING_CEO → REV_APPROVED/REV_REJECTED
```

- `reversal_reason`, `reversal_proof_url` — Employee provides evidence
- Each level reviewed with timestamps and reviewer IDs
- **CEO has final authority** on reversals
- `lop_audit_logs` (~18 records) — Immutable record of all reversals

---

## 14. Travel & Expense Management

### Tables

| Table | Purpose |
|:---|:---|
| `travel_requests` | Travel approval requests |
| `travel_claims` | Post-travel expense claims |
| `travel_rate_config` | Per-km rates and allowances |

### Travel Claim Approval Flow

```
Employee Submit → Admin Review → CEO Review → Accounts Payment
```

---

## 15. Notifications & Alerts

### Notification System

**Table**: `notifications` (~3,692 records)

**Key Fields**:
- `user_id` — Target user (can be null for role-based)
- `role` — Target role for broadcast notifications
- `type` — Categorization (28 types)
- `title`, `message` — Content
- `read_status` — Boolean
- `expires_at` — Auto-expires after 7 days
- `related_record_id` — Links to the triggering record

### Notification Types (28)

```
lop_reversal_progress, lop_reversal_rejected, lop_reversal_approved,
lop_approved, lop_rejected, late_submission, payment_paid,
payment_approved, payment_rejected, payment_hold, task_assigned,
eod_submitted, material, material_request, leave_request,
escalation, critical, general, attendance, mention, reminder,
compliance_report, selfie_compliance, absent_alert, critical_blast,
escalation_assigned, escalation_critical, sla_breach, critical_assigned
```

### Audio Alerts

- `alertSounds.ts` — Manages critical alert sounds (War Room style)
- `notificationSound.ts` — Standard notification sounds
- Used for escalation/critical SLA breaches to grab attention

---

## 16. AI & Intelligence Layer

### AI Tables

| Table | Purpose |
|:---|:---|
| `ai_nudges` | Proactive suggestions/nudges to users |
| `ai_employee_scores` | AI-computed employee performance scores |

### Edge Functions for AI

- `erp-intelligence/` — ERP-wide analytics and pattern detection
- `intelligence-analyze/` — Deep analysis of operational data
- `evaluate-selfie-compliance/` — AI selfie verification

### Intelligence Features

- **Emergency Abuse Detection**: Flags employees who misuse "Emergency" urgency to skip payment queues
- **Department Discipline Scores**: Data-driven ranking of protocol compliance
- **Urgency Pattern Analysis**: Identifies patterns in escalation timing
- **Admin Rejection Patterns**: Monitors rejection rates and reasons

### Risk Engine (`src/lib/riskEngine.ts`)

Client-side risk scoring for payment requests considering:
- Amount thresholds
- Vendor history
- Frequency patterns
- Evidence quality

---

## 17. CEO Command Center

### CEO Dashboard (`/ceo-dashboard`)

The CEO's primary cockpit providing a real-time "Operational Pulse":

1. **Live Operational Fire-deck**: Real-time stream of all L1/L2/L3 escalations and criticals
2. **Financial Pulse**: Daily paid spend charts, vendor concentration analysis
3. **Project Health**: Bird's-eye view of Engineering and Agriculture project statuses
4. **Real-time Attendance**: Selfie-Wall and Activity Feed of field staff
5. **LOP Reversals Tab**: Approve/reject attendance reversal requests
6. **Farm Updates Tab**: Agriculture project data from field

### CEO Intelligence (`/ceo-intelligence`)

Strategic long-term analytics:
- Monthly burn rate trends
- Department discipline score rankings
- Urgency pattern analysis
- Admin rejection overviews

### CEO Approvals (`/ceo-approvals`)

- Payment request approval/rejection (with hold option)
- Work Order & Purchase Order approvals
- Held payments are visually highlighted

### CEO Action Items

| Action | Route | Frequency |
|:---|:---|:---|
| Approve Payments | `/ceo-approvals` | Daily |
| Review Fire-deck | `/ceo-dashboard` | Every few hours |
| Audit Discipline | `/ceo-intelligence` | Weekly |
| Approve LOP Reversals | `/ceo-dashboard` (Reversals Tab) | Weekly |
| Check Farm Updates | `/ceo-dashboard` (Farm Tab) | Site Visit Prep |

---

## 18. Database Schema

### Complete Table Inventory (60+ tables, all with RLS enabled)

#### Workforce & Attendance
| Table | Records | RLS |
|:---|:---|:---|
| `profiles` | 116 | ✅ |
| `day_starts` | 2,095 | ✅ |
| `day_plans` | 2,152 | ✅ |
| `hourly_plans` | 11,696 | ✅ |
| `hourly_reports` | 16,399 | ✅ |
| `eod_reports` | 1,931 | ✅ |
| `late_reasons` | 0 | ✅ |
| `extra_work_entries` | 711 | ✅ |
| `selfie_records` | 1,196 | ✅ |
| `hr_attestations` | 715 | ✅ |
| `admin_reviews` | 0 | ✅ |
| `employee_issues` | 0 | ✅ |

#### Financial
| Table | Records | RLS |
|:---|:---|:---|
| `payment_requests` | 278 | ✅ |
| `payees` | — | ✅ |
| `bulk_batches` | — | ✅ |
| `daily_expense_sheet` | — | ✅ |
| `work_order_payments` | — | ✅ |
| `client_collections` | — | ✅ |

#### LOP & Leave
| Table | Records | RLS |
|:---|:---|:---|
| `lop_entries` | 483 | ✅ |
| `lop_audit_logs` | 18 | ✅ |
| `leave_types` | 4 | ✅ |
| `leave_requests` | 64 | ✅ |

#### Escalations & Criticals
| Table | Records | RLS |
|:---|:---|:---|
| `client_escalations` | 235 | ✅ |
| `client_escalation_timeline` | 2,316 | ✅ |
| `hourly_criticals` | 167 | ✅ |
| `hourly_critical_timeline` | 1,384 | ✅ |
| `escalations` | 0 | ✅ (legacy) |
| `escalation_timeline` | 0 | ✅ (legacy) |

#### Engineering & Projects
| Table | Records | RLS |
|:---|:---|:---|
| `projects` | 89 | ✅ |
| `project_verticals` | 9 | ✅ |
| `project_phases` | 2 | ✅ |
| `project_boq` | 4 | ✅ |
| `project_milestones` | — | ✅ |
| `project_execution_proofs` | — | ✅ |
| `project_timeline` | — | ✅ |
| `project_inventory` | — | ✅ |
| `project_variations` | — | ✅ |
| `daily_site_updates` | — | ✅ |
| `boq_templates` | — | ✅ |
| `milestone_deviation_requests` | — | ✅ |

#### Procurement
| Table | Records | RLS |
|:---|:---|:---|
| `work_orders` | 0 | ✅ |
| `purchase_orders` | 0 | ✅ |
| `material_requests` | — | ✅ |
| `vendor_quotes` | — | ✅ |
| `vendor_work_requests` | — | ✅ |
| `vendor_ratings` | — | ✅ |
| `procurement_timeline` | — | ✅ |
| `purchase_progress_logs` | — | ✅ |

#### Agriculture
| Table | Records | RLS |
|:---|:---|:---|
| `cultivation_cycles` | — | ✅ |
| `daily_farm_logs` | — | ✅ |
| `harvest_records` | — | ✅ |
| `farm_manager_remarks` | — | ✅ |
| `inventory_usage_logs` | — | ✅ |

#### Shifts
| Table | Records | RLS |
|:---|:---|:---|
| `shift_sessions` | — | ✅ |
| `shift_user_assignments` | — | ✅ |
| `shift_assignment_history` | — | ✅ |

#### Travel
| Table | Records | RLS |
|:---|:---|:---|
| `travel_requests` | — | ✅ |
| `travel_claims` | — | ✅ |
| `travel_rate_config` | — | ✅ |

#### System & Misc
| Table | Records | RLS |
|:---|:---|:---|
| `audit_logs` | 20,457 | ✅ |
| `notifications` | 3,692 | ✅ |
| `announcements` | 0 | ✅ |
| `task_assignments` | 0 | ✅ |
| `task_comments` | 0 | ✅ |
| `company_calendar` | 11 | ✅ |
| `ai_nudges` | — | ✅ |
| `ai_employee_scores` | — | ✅ |
| `user_location_logs` | — | ✅ |
| `geofences` | — | ✅ |
| `attendance_lock_overrides` | — | ✅ |
| `week_off_assignments` | — | ✅ |
| `rental_property_remarks` | — | ✅ |

### Key Database Design Patterns

1. **UUID Primary Keys**: All tables use `gen_random_uuid()` for IDs.
2. **Timestamp Tracking**: `created_at`, `updated_at` on most tables.
3. **User References**: Foreign keys to `profiles.id` for accountability (who created, who approved, who rejected).
4. **Status Enums via CHECK**: Status fields use PostgreSQL CHECK constraints, not enum types.
5. **JSONB for Flexibility**: `audit_timeline`, `details` fields use JSONB for structured-but-flexible data.
6. **Array Fields**: `tags[]`, `assigned_user_ids[]`, `proof_screenshot_urls[]` use PostgreSQL arrays.
7. **RLS Everywhere**: Every single table has Row Level Security enabled.
8. **Soft Deletes**: Records are rarely deleted; `is_active` flags are used instead.

---

## 19. Supabase Edge Functions

### Function Inventory

| Function | JWT Required | Purpose |
|:---|:---|:---|
| `check-sla-breach` | No | Scheduled: Detects SLA breaches on escalations/criticals and promotes tickets |
| `blast-critical-alerts` | No | Broadcasts critical alerts to GM/Admin/CEO when SLA breaches occur |
| `evaluate-selfie-compliance` | No | Checks if employees submitted required selfies |
| `auto-mark-absent` | No | Marks employees as absent if they haven't logged in by cutoff time |
| `generate-compliance-report` | No | Generates compliance reports for attendance and reporting adherence |
| `bulk-generate-lop` | No | Bulk creates LOP entries for compliance violations |
| `erp-intelligence` | No | Analytics engine for operational intelligence |
| `intelligence-analyze` | No | Deep data analysis for pattern detection |
| `create-user` | Yes | Admin-only: Creates new user accounts in Supabase Auth + profiles |
| `update-user` | Yes | Admin-only: Updates user profile information |
| `send-notification` | Yes | Dispatches push notifications to users |
| `ai-score-employee` | — | Computes AI performance scores for employees |
| `ai-predict-delays` | — | Predicts potential project delays |
| `ai-nudge-system` | — | Generates proactive nudges/suggestions |

### JWT Verification

From `supabase/config.toml`, functions with `verify_jwt = false` run as scheduled/background tasks without authentication requirements. Functions requiring JWT are called from the authenticated frontend.

---

## 20. Mobile Application

### Technology

- **Framework**: React Native with Expo
- **Router**: Expo Router (file-based)
- **Shared Backend**: Same Supabase instance as web app

### Key Screens

| Screen | Purpose |
|:---|:---|
| `HomeScreen` | Day Start flow with attendance protocol |
| `DayPlanScreen` | Daily task planning |
| `HourlyReportScreen` | Hourly proof-of-work submission |
| `EODScreen` | End-of-day summary |
| `LOPReversalScreen` | Request LOP reversals with image upload |
| `PaymentRequestScreen` | Submit payment requests |
| `EscalationScreen` | View/manage escalations |
| `NotificationsScreen` | Push notification center |
| `ProfileScreen` | User profile management |

### Mobile-Specific Features

- **Camera Integration**: Selfie capture for attendance
- **GPS Location**: Geofenced attendance verification
- **Image Upload**: Direct photo upload for proofs (via `expo-image-picker`)
- **Push Notifications**: Real-time alerts for escalations and approvals

---

## 21. Key Libraries & Utilities

### `src/lib/utils.ts`
```typescript
// Class name merger for Tailwind + shadcn/ui
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `src/lib/slotHelpers.ts`
Time slot parsing and management for the hourly reporting system.

### `src/lib/slotStatusHelpers.ts`
Computes whether a slot is overdue, in grace period, locked, or completed.

### `src/lib/riskEngine.ts`
Payment risk scoring algorithm — analyzes amount, vendor history, frequency patterns, and evidence quality.

### `src/lib/pdfParser.ts`
Parses uploaded PDF invoices to extract key data (vendor name, amount, date).

### `src/lib/exportUtils.ts`
General data export utilities for generating downloadable files (CSV, Excel).

### `src/lib/expenseSheetExport.ts`
Generates daily expense sheet reports in Excel format for Accounts.

### `src/lib/kotakBankExport.ts`
Formats approved payment data for Kotak Bank's bulk upload file format.

### `src/lib/alertSounds.ts`
Manages preloaded audio buffers for critical alert sounds (used in escalation War Room).

---

## 22. Environment & Configuration

### Environment Variables (`.env`)

```env
VITE_SUPABASE_PROJECT_ID=slfxozmbwogpisxeltty
VITE_SUPABASE_URL=https://slfxozmbwogpisxeltty.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

### Supabase Client (`src/integrations/supabase/client.ts`)

Initializes the Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Development

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
```

### Supabase Local Config (`supabase/config.toml`)

- API port: 54321
- Database port: 54322
- Studio port: 54323
- File size limit: 50MB
- Auth email confirmations: disabled for development

---

## 23. Coding Conventions & Patterns

### File Organization

- **Pages**: One directory per page in `src/pages/`, named by role or module.
- **Components**: Atomic components in `src/components/ui/`, domain components grouped by feature.
- **Hooks**: Custom hooks in `src/hooks/`, named `use{Feature}.ts`. Pattern: query/mutation wrappers around Supabase.
- **Types**: Centralized in `src/types/`.

### Common Hook Pattern

```typescript
// Example: usePaymentRequests.ts
export function usePaymentRequests(filters?: Filters) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['payment-requests', filters],
    queryFn: async () => {
      let q = supabase.from('payment_requests').select('*, profiles!requester_id(name, department)');
      // Apply filters...
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PaymentRequest> }) => {
      const { error } = await supabase.from('payment_requests').update(updates).eq('id', id);
      if (error) throw error;
      // Log to audit_logs
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-requests'] }),
  });

  return { ...query, updatePayment: updateMutation.mutateAsync };
}
```

### Audit Logging Pattern

Every significant action inserts into `audit_logs`:

```typescript
await supabase.from('audit_logs').insert({
  action: 'PAYMENT_APPROVED',
  performed_by: user.id,
  performed_by_name: user.name,
  performed_by_role: user.role,
  record_type: 'payment_request',
  record_id: paymentId,
  before_state: { status: 'admin_audit' },
  after_state: { status: 'ceo_audit', admin_approved_by: user.id },
  remarks: `Payment #${paymentNumber} approved by Admin`,
});
```

### Supabase Type Casting

Due to auto-generated types sometimes being restrictive, the codebase uses `as any` casts on Supabase table references:

```typescript
const { data, error } = await (supabase.from('profiles') as any)
  .select('*')
  .eq('id', userId)
  .maybeSingle();
```

### Notification Creation Pattern

```typescript
await supabase.from('notifications').insert({
  user_id: targetUserId,          // or null for role-based
  role: 'admin',                   // target role
  type: 'payment_approved',
  title: 'Payment Approved',
  message: `Payment #${number} for ₹${amount} has been approved`,
  related_record_id: paymentId,
});
```

### Component Patterns

- **Layout**: `AppLayout` wraps all authenticated pages with `TopBar` + `Sidebar` + `MobileNav`
- **Styling**: Tailwind utility classes with `cn()` helper for conditional classes
- **Icons**: Lucide React icons throughout
- **Toasts**: `sonner` library for feedback (`toast.success()`, `toast.error()`)
- **Dialogs**: shadcn/ui `Dialog` for modals, `Sheet` for side panels
- **Tables**: shadcn/ui `Table` with custom filtering, sorting, pagination
- **Charts**: `Recharts` for data visualization (BarChart, PieChart, LineChart)

---

## Appendix: Quick Reference

### Indian Business Context

- **Currency**: Indian Rupees (₹ / INR)
- **Timezone**: IST (Indian Standard Time / UTC+5:30)
- **Banking**: Kotak Bank as primary payment processor
- **UPI**: Unified Payments Interface — instant payment system
- **UTR**: Unique Transaction Reference — bank transfer ID
- **IFSC**: Indian Financial System Code — bank branch identifier
- **LOP**: Loss of Pay — salary deduction for absence/violations
- **BOQ**: Bill of Quantities — standard construction costing document
- **GRN**: Goods Receipt Note — delivery acknowledgment
- **PO**: Purchase Order
- **WO**: Work Order
- **EOD**: End of Day
- **SLA**: Service Level Agreement

### Department Shorthands

| Code | Full Name |
|:---|:---|
| SMO | Senior Management Operations |
| GMO | General Manager Operations |
| BOI | Board of Intelligence |
| NSM | National Sales Manager |
| RSH | Regional Service Head |
| BD | Business Development |
| HR | Human Resources |

### Common Status Patterns

Most status fields in the database follow this general pattern:
```
pending → {role}_audit → ... → approved/rejected → paid/closed
```

With specific statuses depending on the entity (payment, escalation, leave, LOP).

---

*This document was generated from the live codebase and production database of the IGO Chain application. It reflects the system state as of February 2026.*
