# IGO GROUP ENTERPRISE RESOURCE PLANNING (ERP) SYSTEM
## Complete Technical Documentation

**Version**: 1.0
**Last Updated**: March 2026
**System Status**: Production (Active)

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Organizational Structure (15+ Departments)](#organizational-structure)
6. [10 Major Business Modules](#10-major-business-modules)
7. [Database Schema Overview](#database-schema-overview)
8. [Key Features & Capabilities](#key-features--capabilities)
9. [Data Flow & Integration](#data-flow--integration)
10. [Approval Workflows](#approval-workflows)
11. [Appendices](#appendices)

---

## EXECUTIVE SUMMARY

IGO Group ERP is a comprehensive, role-based enterprise resource planning system built to manage complex multi-department operations, financial workflows, project execution, and real-time operational tracking. The system serves 15+ specialized departments and manages over 100+ database tables across 10 major business modules.

**System Purpose**: Enable seamless coordination between departments (Engineering, Finance, HR, Procurement, Field Operations) with built-in financial controls, audit trails, and AI-driven insights.

**Key Statistics**:
- **15+ Role-based Departments** serving distinct organizational functions
- **10 Major Business Modules** covering project, financial, and operational management
- **100+ Database Tables** in Supabase PostgreSQL
- **150+ Custom React Hooks** for data management and operations
- **120+ Pages** with role-specific dashboards and workflows
- **Complete Audit Trail** for all transactions and approvals
- **Real-time Synchronization** via Supabase subscriptions

---

## SYSTEM OVERVIEW

### What is IGO Group ERP?

IGO Group ERP is a full-stack web application designed to manage:

1. **Project Lifecycle** - From budgeting through execution and completion
2. **Financial Operations** - Multiple payment types with multi-level approvals
3. **Work Order Management** - Complex multi-stage approval workflows
4. **Human Resources** - Payroll, attendance, leave management
5. **Procurement** - Vendor management, sourcing, purchasing
6. **Field Operations** - Real-time tracking of work and progress
7. **Shift Management** - Hourly employee operations and accountability
8. **Escalations** - Multi-level issue escalation and resolution
9. **Data Integrity** - Complete audit trails and compliance tracking
10. **Intelligence** - AI-driven analytics and reporting

### Organizational Context

IGO Group operates multiple business lines:
- **Construction/Engineering Projects** - Site-based work with equipment and materials
- **Agricultural Operations** - Farm management with seasonal cycles
- **Equipment Rentals** - Property and equipment leasing
- **Vendor & Supplier Network** - Multiple vendor relationships

The ERP system integrates all these operations into a single platform with role-based access and workflow controls.

---

## TECHNOLOGY STACK

### Frontend (Client-Side)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 18.3.1 | UI library and component rendering |
| **Language** | TypeScript | 5.8.3 | Type-safe development |
| **Build Tool** | Vite | 6.1.6 | Fast bundling and development server |
| **Routing** | React Router | 7.13.0 | Multi-page navigation and routing |
| **UI Components** | Shadcn/UI + Radix UI | Latest | Accessible, unstyled components |
| **Styling** | Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| **Form Handling** | React Hook Form | 7.61.1 | Performant form state management |
| **State Management** | React Query | 5.83.0 | Server state management and caching |
| **Context API** | React Context | Built-in | Local state management |
| **Charts & Graphs** | Recharts | 2.15.4 | Data visualization |
| **Maps** | Leaflet & React Leaflet | Latest | Geospatial mapping |
| **Notifications** | Sonner & Toaster | Latest | Toast notifications |
| **PDF Export** | jsPDF & html2pdf | Latest | Document generation |
| **Excel Export** | XLSX | 0.20.3 | Spreadsheet export |
| **Animations** | Framer Motion | 12.23.26 | Motion and animation |
| **Icons** | Lucide React | 0.462.0 | Icon library |

### Backend (Database & API)

| Component | Technology | Details |
|-----------|-----------|---------|
| **Database** | Supabase (PostgreSQL) | Version 14.1, Real-time enabled |
| **ORM** | PostgREST API | Auto-generated REST API from PostgreSQL |
| **Real-time** | Supabase Realtime | WebSocket-based subscriptions |
| **Authentication** | Supabase Auth | JWT-based with Postgres Row Level Security (RLS) |
| **File Storage** | Supabase Storage | S3-compatible object storage |

### Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code quality and linting |
| TypeScript ESLint | Type safety and linting |
| Autoprefixer | CSS vendor prefixes |
| PostCSS | CSS transformation |
| Vite Plugins | SWC for fast transpilation |

### Performance & Monitoring

| Tool | Purpose |
|------|---------|
| Vercel Speed Insights | Web Vitals monitoring |
| React Query DevTools | State debugging |
| Browser DevTools | Performance profiling |

---

## SYSTEM ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER (React)              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Pages      │  │  Components  │  │  Hooks     │  │
│  │  (120+)     │  │  (UI/Logic)  │  │  (150+)    │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬─────┘  │
└─────────┼──────────────────┼──────────────────┼─────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────┐
│         STATE MANAGEMENT LAYER                       │
│  ┌──────────────────┐  ┌──────────────────────┐    │
│  │  React Query     │  │  Context API         │    │
│  │  (Server State)  │  │  (Local State)       │    │
│  └────────┬─────────┘  └──────────┬───────────┘    │
└───────────┼──────────────────────┼─────────────────┘
            │                      │
┌───────────▼──────────────────────▼─────────────────┐
│      API CLIENT LAYER (Supabase JS Client)         │
│  ┌─────────────────────────────────────────────┐   │
│  │  - Database Queries (CRUD)                  │   │
│  │  - Real-time Subscriptions                  │   │
│  │  - Authentication                           │   │
│  │  - File Storage                             │   │
│  └────────────────┬────────────────────────────┘   │
└──────────────────┼────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────┐
│    BACKEND LAYER (Supabase/PostgreSQL)            │
│  ┌──────────────────────────────────────────────┐ │
│  │  - PostgreSQL Database (100+ Tables)         │ │
│  │  - Row Level Security (RLS) Policies         │ │
│  │  - PostgREST API (Auto-generated)            │ │
│  │  - Real-time Subscriptions                   │ │
│  │  - JWT Authentication                        │ │
│  │  - S3-compatible Storage                     │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
User Interaction
    ↓
React Component
    ↓
Custom Hook (useX)
    ↓
Supabase Client Instance
    ↓
PostgREST API / Real-time Channel
    ↓
PostgreSQL Database
    ↓
RLS (Row Level Security) Policies
    ↓
Execute CRUD Operation
    ↓
Real-time Broadcast (if subscribed)
    ↓
React Query Cache Update
    ↓
Component Re-render
    ↓
Multi-level Approval Logic (if applicable)
    ↓
Audit Log Entry
    ↓
Notification & Escalation (if triggered)
```

### Module Organization

```
src/
├── pages/              # 120+ Role-specific pages
│   ├── admin/         # Admin dashboards (30+ pages)
│   ├── ceo/          # CEO dashboards (10+ pages)
│   ├── employee/     # Employee operations (12+ pages)
│   ├── engineering/  # Project management (6+ pages)
│   ├── finance/      # Finance operations
│   ├── hr/          # HR and payroll
│   ├── shift/       # Shift operations (6+ pages)
│   └── ...          # Other departments (20+ pages)
├── components/        # Reusable UI components
│   ├── layout/       # Layout components
│   ├── ui/          # Shadcn/UI components
│   ├── work-orders/ # WO-specific components
│   └── ...          # Domain-specific components
├── hooks/            # 150+ Custom data hooks
│   ├── useWorkOrders.ts
│   ├── usePayments.ts
│   ├── useProjects.ts
│   └── ...          # One hook per data entity
├── integrations/     # External integrations
│   └── supabase/    # Supabase configuration and types
├── contexts/         # React Context providers
│   ├── AuthContext.tsx
│   └── ChatOverlayContext.tsx
├── services/         # Business logic services
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
├── lib/             # Library functions
└── modules/         # Feature-specific modules
    └── hr-payroll/  # HR & Payroll module
```

---

## ORGANIZATIONAL STRUCTURE

### 15+ Role-Based Departments

The system is organized around 15+ distinct organizational roles, each with specific dashboards, permissions, and workflows:

#### 1. **ADMIN** (System Administration)
- **Role**: System administrators and super users
- **Key Responsibilities**:
  - User account management and provisioning
  - Role and permission assignments
  - System configuration and settings
  - Cron job management
  - Notification tone customization
  - Employee directory management
  - Department management
  - Core head assignments
- **Key Pages**: AdminDashboardPage, UserManagementPage, RoleManagementPage, DepartmentManagementPage
- **Key Data**: User profiles, roles, permissions, audit logs

#### 2. **CEO / EXECUTIVE** (Chief Executive Officer)
- **Role**: Ultimate decision-maker and approver
- **Key Responsibilities**:
  - Final approval on work orders (≥ negotiated_amount)
  - Approval of major project changes
  - CEO holds (placing WOs on hold for investigation)
  - Escalation review and resolution
  - Executive intelligence and reporting
  - Department oversight
  - Strategic decision-making
- **Key Pages**: CEODashboardPage, CEOApprovalsPage, CEOWorkOrdersPage, CEOEscalationsPage, CEOIntelligencePage
- **Key Data**: All work orders, major payments, escalations, projects

#### 3. **ENGINEERING** (Project Engineering)
- **Role**: Technical project execution and planning
- **Key Responsibilities**:
  - Project planning and structuring
  - BOQ (Bill of Quantities) creation
  - Work order initiation with approved budgets
  - Scope definition
  - Technical feasibility assessment
  - Project deal management
- **Key Pages**: EngineerDashboardPage, BOQBuilderPage, DealUploadPage, ProjectExecutionDashboard
- **Key Data**: Projects, BOQs, work orders, phases, milestones

#### 4. **GMO** (General Manager Operations)
- **Role**: Operations oversight and budget authorization
- **Key Responsibilities**:
  - Budget approval for work orders (Stage 1)
  - Project financial oversight
  - Team management
  - Task assignment
  - New deals review
  - Project financing review
  - BOQ approvals
- **Key Pages**: GMODashboardPage, GMOProjectsPage, GMOBOQApprovalsPage, GMOPaymentsPage
- **Key Data**: Projects, budgets, BOQs, team performance

#### 5. **SMO** (Site Manager Operations)
- **Role**: Site-level technical verification
- **Key Responsibilities**:
  - Technical verification of work orders (Stage 1)
  - BOQ approvals from site perspective
  - Site management
  - Task oversight
  - Ticket resolution
- **Key Pages**: SMODashboardPage, SMOProjectsPage, BOQApprovalsPage, SMOTicketsPage
- **Key Data**: Work orders, site updates, tasks, BOQs

#### 6. **HR / PAYROLL** (Human Resources)
- **Role**: Employee management and compensation
- **Key Responsibilities**:
  - Salary processing and payslip generation
  - Leave request approvals
  - Attendance verification
  - LOP (Loss of Pay) management
  - Employee records maintenance
  - Payroll auditing
  - Employee activity monitoring
- **Key Pages**: LeaveApprovalsPage, LOPManagementPage, HRPaymentAuditPage, EmployeeActivityPage
- **Key Data**: Employees, salaries, payslips, leave records, attendance

#### 7. **FINANCE / ACCOUNTS** (Financial Operations)
- **Role**: Financial execution and reconciliation
- **Key Responsibilities**:
  - Payment execution (salary, work order, petty cash, etc.)
  - Payment reconciliation
  - Accounts receivable/payable
  - Petty cash management
  - Financial auditing
  - Bank reconciliation
- **Key Pages**: AccountsExecutionPage, AccountsSalaryExecutionPage, ReconciliationHubPage, PettyCashAuditPage
- **Key Data**: Payments, reconciliations, transactions, petty cash

#### 8. **PROCUREMENT / VENDOR** (Sourcing & Vendors)
- **Role**: Vendor management and procurement
- **Key Responsibilities**:
  - Vendor identification and qualification
  - Quote collection and management
  - Vendor negotiation
  - Purchase order creation
  - Vendor performance tracking
  - Vendor portal management
- **Key Pages**: VendorSourcingDashboard, PurchaseDashboard, AdminProcurementPage
- **Key Data**: Vendors, quotes, purchase orders, vendor ratings

#### 9. **SITE MANAGER** (Field Operations)
- **Role**: On-site work coordination
- **Key Responsibilities**:
  - Daily site updates (photos/videos)
  - Work progress tracking
  - Execution proof documentation
  - Inventory management
  - Site team coordination
- **Key Pages**: SiteManagerDashboard, ProjectInventoryPage
- **Key Data**: Daily site updates, inventory, project execution proofs

#### 10. **SHIFT MANAGEMENT** (Hourly Operations)
- **Role**: Hourly employee accountability
- **Key Responsibilities**:
  - Shift start/end management
  - Hourly plan creation
  - Break management
  - End-of-day summaries
  - Shift history tracking
  - Location verification
- **Key Pages**: ShiftDashboardPage, ShiftHourlyPage, ShiftEODPage, ShiftBreakPage
- **Key Data**: Shift sessions, hourly plans, breaks, location tracking

#### 11. **AUDITOR** (Financial Compliance)
- **Role**: Payment auditing and fraud detection
- **Key Responsibilities**:
  - Payment audit and verification
  - Fraud detection
  - Compliance checking
  - Payment approval (secondary level)
  - Audit report generation
- **Key Pages**: AuditorDashboardPage, AuditorPaymentAuditPage
- **Key Data**: Payments, fraud alerts, audit logs

#### 12. **GM** (General Manager)
- **Role**: Department-level oversight
- **Key Responsibilities**:
  - Department dashboard overview
  - Payment approvals
  - Escalation handling
  - Team performance review
- **Key Pages**: GMDashboardPage, GMPaymentsPage, GMEscalationsPage
- **Key Data**: Departmental KPIs, payments, escalations

#### 13. **BOI** (Bank of India Liaison)
- **Role**: Bank coordination
- **Key Responsibilities**:
  - Bank payment processing
  - Payment status tracking
  - Bank reconciliation
- **Key Pages**: BOIDashboardPage, BOIPaymentsPage
- **Key Data**: Bank transactions, payment status

#### 14. **RENTAL MANAGEMENT** (Asset Rentals)
- **Role**: Equipment and property rentals
- **Key Responsibilities**:
  - Rental property management
  - Rental portfolio oversight
  - Rental approvals
  - Asset tracking
- **Key Pages**: CEORentalApprovalPage, CEORentalPortfolioPage, RentalBulkRaisePage
- **Key Data**: Rental properties, rental agreements, rental portfolio

#### 15. **FARM MANAGEMENT** (Agricultural Operations)
- **Role**: Farm operations
- **Key Responsibilities**:
  - Cultivation cycle management
  - Daily farm logging
  - Harvest record management
  - Farm resource planning
- **Key Pages**: FarmManagerDashboard
- **Key Data**: Cultivation cycles, farm logs, harvest records

#### Additional Supporting Roles:

- **EMPLOYEE**: Field workers and staff
- **DIRECTOR**: Senior management oversight
- **CORE HEAD**: Department heads
- **NSM**: New Store Manager (if applicable)
- **DATA TEAM**: Analytics and reporting
- **TRANSPORT**: Logistics and transport management

---

## 10 MAJOR BUSINESS MODULES

### 1. WORK ORDER MANAGEMENT MODULE

**Purpose**: Manage the complete lifecycle of work orders from creation to completion with strict financial controls and approval workflows.

**Work Order Lifecycle** (Defined in: `directives/01_work_order_management.md`)

#### Stage 1: Budget Initiation & Approval
```
Step 1: Initiation
  └─ Site Engineer/Manager creates Work Order
     ├─ Link to: Project, Phase, Milestone
     ├─ Specify: Approved Budget (from BOQ)
     ├─ Specify: Detailed Scope
     └─ Status: pending_approval

Step 2: Approval Chain
  ├─ SMO (Site Manager Operations)
  │  └─ Technical verification
  │     └─ Approve/Reject
  │
  └─ GMO (General Manager Operations)
     └─ Budget authorization
        └─ Approve/Reject
        └─ Status: pending_vendor_sourcing
```

#### Stage 2: Vendor Sourcing & Alignment
```
Step 1: Sourcing
  └─ Procurement identifies vendors
     ├─ Collects quotes
     └─ Records: vendor_name, quote_amount, terms

Step 2: Alignment
  └─ Procurement negotiates
     ├─ Records: negotiated_amount
     ├─ Records: vendor_bank_details / UPI
     └─ Verification: negotiated_amount vs approved_budget
        └─ If DEVIATION: Flag for review
        └─ If APPROVED: Proceed

Step 3: Verification
  └─ GM verifies negotiated terms
     └─ Status: pending_admin
```

#### Stage 3: Final Execution Authorization
```
Step 1: Admin Review
  └─ Final check of:
     ├─ Documentation completeness
     ├─ Vendor details accuracy
     ├─ Financial terms
     └─ Compliance requirements

Step 2: CEO Approval
  └─ Ultimate authorization
     ├─ Review all details
     ├─ Approve/Reject
     └─ Or: Place on ceo_hold
        └─ For further investigation

Step 3: Execution
  └─ WO Status: in_execution
     ├─ Assign to execution team
     ├─ Track progress
     └─ Monitor costs
```

#### Payment & Verification Requirements

```
Advance Payment:
  ├─ Requires: Signed WO document upload
  ├─ Approval: CEO/CFO
  └─ Status: advance_paid

Execution Phase:
  ├─ Daily Site Updates (photos/videos)
  │  └─ Linked to: project_execution_proofs
  │  └─ Linked to: WO phase
  │  └─ Frequency: Daily or as specified
  │
  └─ Progress Tracking
     ├─ Material consumption
     ├─ Labor hours
     └─ Quality verification

Final Payment:
  ├─ Requires: Completion verification
  ├─ Requires: Site team sign-off
  ├─ Requires: All proofs uploaded
  └─ Approval: Auditor → Finance → CEO
```

**Work Order Statuses**:
- `pending_approval` - Waiting for SMO/GMO approval
- `pending_vendor_sourcing` - Waiting for vendor selection
- `pending_admin` - Waiting for admin review
- `pending_ceo_approval` - Waiting for CEO approval
- `ceo_hold` - Placed on hold by CEO
- `in_execution` - Currently being executed
- `completed` - Completed and closed
- `rejected` - Rejected at any stage
- `cancelled` - Cancelled before execution

**Edge Cases**:
- Budget deviation (negotiated > approved) → Requires explicit justification
- Duplicate work orders → System prevents duplicates
- WO cancellation → Only if not yet in execution
- Cost overruns → Escalated to CEO

**Key Tables**:
- `work_orders` - Main WO records
- `work_order_payments` - Payment tracking
- `work_order_audits` - Audit trails
- `project_execution_proofs` - Site photos/videos

**Key Hooks**:
- `useWorkOrders()` - Core WO operations
- `useWorkOrderPayments()` - Payment tracking
- `useWorkOrderAudits()` - Audit trails

---

### 2. PROJECT MANAGEMENT MODULE

**Purpose**: Manage complete project lifecycle from planning through execution.

**Project Hierarchy**:
```
Company
  └─ Project (1..*)
      ├─ Vertical (e.g., Residential, Commercial, etc.)
      ├─ Status (Planning → Execution → Completion)
      │
      └─ Phase (1..*)
          ├─ Budget allocation
          ├─ Scope definition
          │
          └─ Milestone (1..*)
              ├─ Deliverables
              ├─ Timeline
              │
              └─ Task (1..*)
                  ├─ Assignment
                  ├─ Progress
                  └─ Dependencies
```

**Key Workflows**:

1. **Project Creation**
   - Define project scope, timeline, budget
   - Assign project manager
   - Create initial phases and milestones
   - Set vertical/category

2. **BOQ (Bill of Quantities) Management**
   - Engineering creates detailed BOQ
   - Specifies materials, quantities, unit rates
   - Calculates total budget
   - SMO reviews and approves
   - GMO authorizes budget

3. **Work Order Issuance**
   - From BOQ, engineer creates work orders
   - References BOQ line items
   - Triggers approval workflow
   - Allocates budget from project reserve

4. **Execution Tracking**
   - Daily site updates
   - Progress measurement
   - Material consumption tracking
   - Quality verification
   - Timeline adherence

5. **Project Closure**
   - Final verification
   - All proofs uploaded
   - Final payments executed
   - Project marked complete

**Key Tables**:
- `projects` - Main project records
- `project_phases` - Phase breakdown
- `project_milestones` - Milestone tracking
- `boq_items` - BOQ line items
- `tasks` - Individual work tasks
- `task_assignments` - Task ownership

**Key Hooks**:
- `useProjects()` - Project operations
- `useProjectPhases()` - Phase management
- `useMilestones()` - Milestone tracking
- `useBOQ()` - BOQ operations
- `useProjectHealth()` - Health monitoring

---

### 3. FINANCIAL OPERATIONS MODULE

**Purpose**: Manage all types of payments with multi-level approvals and complete audit trails.

**Payment Types**:

#### A. Work Order Payments
- Advance payments (after CEO approval)
- Progress payments (based on milestones)
- Final payments (upon completion)
- Vendor bank transfer or UPI

#### B. Salary Payments (HR-Payroll)
- Monthly payroll processing
- Payslip generation
- Deductions and allowances
- Bank transfer to employee accounts
- LOP (Loss of Pay) adjustments

#### C. Petty Cash
- Small expense reimbursement
- Advance requests
- Settlement and reconciliation
- Departmental budgets

#### D. Transport Expenses
- Employee travel reimbursement
- Fuel expenses
- Vehicle maintenance
- Route-based analytics

#### E. Porter Payments
- Labor-based compensation
- Daily/hourly rate
- Attendance-based

**Payment Approval Workflow**:

```
Employee/Manager creates Payment Request
  ├─ Amount
  ├─ Category
  ├─ Justification
  └─ Attachments (bills, receipts)

  ↓

Department Head Approval
  ├─ Budget check
  ├─ Policy compliance
  └─ Approve/Reject

  ↓ (if approved)

Finance Review
  ├─ Documentation verification
  ├─ Amount verification
  └─ Bank account validation

  ↓ (if approved)

Auditor Review (for payments > threshold)
  ├─ Fraud detection
  ├─ Compliance check
  └─ Approve/Reject

  ↓ (if approved)

CEO/GM Final Approval
  └─ Ultimate authorization

  ↓ (if approved)

Finance Execution
  ├─ Generate bank file
  ├─ Execute transfer
  └─ Reconcile

  ↓

Payment Complete
  └─ Notification sent to payee
```

**Financial Controls**:

1. **Budget Controls**
   - Department budgets
   - Project budgets
   - Phase budgets
   - Real-time balance tracking

2. **Approval Thresholds**
   - < $100: Manager approval only
   - $100-$1000: Manager + Finance
   - $1000-$10000: Manager + Finance + Auditor
   - > $10000: Manager + Finance + Auditor + CEO

3. **Segregation of Duties**
   - Request creation: Employee/Manager
   - First approval: Department head
   - Review: Finance
   - Audit: Auditor (if applicable)
   - Execution: Finance (different person)

4. **Audit Trail**
   - Every change logged with user, timestamp
   - Immutable approval records
   - Payment execution details
   - Reconciliation records

**Key Tables**:
- `payments` - All payment records
- `payment_requests` - Payment requisitions
- `payment_tags` - Payment categorization
- `petty_cash_*` - Petty cash management
- `reconciliation_*` - Reconciliation records

**Key Hooks**:
- `usePaymentRequests()` - Payment requisition
- `usePaymentValidation()` - Validation logic
- `usePettyCash()` - Petty cash management
- `useReconciliation()` - Reconciliation

---

### 4. HUMAN RESOURCES & PAYROLL MODULE

**Purpose**: Manage employee data, compensation, and compliance.

**Module Location**: `src/modules/hr-payroll/`

**Key Sub-Systems**:

#### A. Employee Management
- Employee master records
- Department assignment
- Designation/role
- Reporting structure
- Contact information

#### B. Salary Management
```
Employee Salary Structure:
  ├─ Basic Pay
  ├─ Allowances
  │  ├─ HRA
  │  ├─ Conveyance
  │  ├─ Special Allowance
  │  └─ Other Allowances
  ├─ Deductions
  │  ├─ PF (Provident Fund)
  │  ├─ TDS (Tax Deducted at Source)
  │  ├─ Insurance
  │  └─ Loan EMI
  └─ Net Pay
```

#### C. Payroll Processing
- Monthly salary calculation
- Payslip generation
- Bank file generation
- Salary approval (HR Manager → Finance → CEO)
- Salary execution (transfer to bank)

#### D. Attendance & LOP
```
LOP (Loss of Pay) Logic:
  ├─ Absent from office: 1 day LOP
  ├─ Late arrival (>30 min): 0.5 day LOP
  ├─ Early departure (>30 min): 0.5 day LOP
  ├─ Weekly Off / Holiday: No LOP
  ├─ Approved Leave: No LOP
  └─ LOP Reversal:
      ├─ Employee can request reversal
      ├─ Manager approval
      ├─ CEO final approval
      └─ Refund salary adjustment
```

#### E. Leave Management
```
Leave Types:
  ├─ Casual Leave (typically 8 days/year)
  ├─ Sick Leave (typically 5 days/year)
  ├─ Personal Leave (typically 3 days/year)
  ├─ Maternity Leave (as per policy)
  ├─ Bereavement Leave (as per policy)
  └─ Earned Leave (as per policy)

Leave Workflow:
  └─ Employee requests leave
     ├─ Specify: Date range, reason, type
     ├─ Manager approval
     ├─ HR verification
     └─ Either: Approved or Rejected
```

#### F. Weekly Performance Tracking
- Weekly targets (set by manager)
- Weekly achievements (reported by employee)
- AI scoring (analyzing quality and consistency)
- Performance trends over time
- Recognition for high performers

#### G. Payslip Management
- Generate payslips (monthly)
- Employee self-service view
- Bulk download as PDF
- Email delivery
- Tax certificate generation (annual)

**Key Tables**:
- `employees` - Employee records
- `salary_structures` - Salary components
- `payslips` - Monthly payslips
- `leave_requests` - Leave applications
- `lop_entries` - Loss of pay
- `attendance_*` - Attendance records
- `weekly_targets` - Target setting
- `weekly_achievements` - Achievement tracking

**Key Hooks**:
- `useLeaveRequests()` - Leave management
- `useLOPEntries()` - LOP tracking
- `useWeeklyAchievements()` - Achievement management
- `useWeeklyTargets()` - Target tracking
- `useEmployeeWeeklyPerformance()` - Performance analysis

---

### 5. PROCUREMENT & VENDOR MANAGEMENT MODULE

**Purpose**: Manage vendor relationships and procurement processes.

**Vendor Lifecycle**:

```
Vendor Identification
  ├─ Vendor application
  ├─ Documentation review
  ├─ Site visit (if applicable)
  └─ Approval as active vendor

  ↓

Vendor Qualification
  ├─ Quality certifications
  ├─ Financial stability
  ├─ References
  └─ Insurance & compliance

  ↓

Quote Collection
  ├─ Send quote requests
  ├─ Receive quotes
  ├─ Comparison analysis
  └─ Negotiation

  ↓

Selection & Order
  ├─ Select best vendor
  ├─ Finalize terms
  ├─ Generate purchase order
  └─ Place order

  ↓

Delivery & Quality
  ├─ Receive goods
  ├─ Verify quality
  ├─ Update inventory
  └─ Match with PO

  ↓

Invoice & Payment
  ├─ Receive invoice
  ├─ Verify amount
  ├─ Match with PO & receipt
  ├─ Approve for payment
  └─ Execute payment

  ↓

Vendor Rating
  ├─ Rate on: Quality, Delivery, Price
  ├─ Update vendor performance score
  └─ Use for future vendor selection
```

**Key Workflows**:

1. **Work Order Sourcing**
   - From work order, identify suitable vendors
   - Send quote requests
   - Collect and compare quotes
   - Negotiate terms
   - Record negotiated amount and vendor details
   - GM verification
   - Proceed to WO approval

2. **Material Purchase**
   - Material request from site
   - Vendor quote collection
   - Purchase order creation
   - Goods receipt verification
   - Invoice matching
   - Payment processing

3. **Vendor Portal**
   - Public-facing portal for vendors
   - Quote submission
   - Order status tracking
   - Invoice submission
   - Payment status visibility

**Performance Metrics**:
- Quality of deliverables
- On-time delivery rate
- Price competitiveness
- Documentation accuracy
- Customer satisfaction

**Key Tables**:
- `vendors` - Vendor master records
- `vendor_quotes` - Quote management
- `vendor_ratings` - Performance ratings
- `vendor_performance` - Detailed metrics
- `purchase_orders` - PO records
- `material_deliveries` - Delivery tracking

**Key Hooks**:
- `useVendorMaster()` - Vendor management
- `useVendorQuotes()` - Quote handling
- `useVendorSourcingQueue()` - Sourcing workflow
- `useVendorRatings()` - Performance tracking
- `usePurchaseOrders()` - PO management

---

### 6. SHIFT MANAGEMENT MODULE

**Purpose**: Manage hourly employee operations with accountability and real-time tracking.

**Shift Operations Workflow**:

```
9:00 AM - SHIFT START
  ├─ Employee logs in (Shift Login Page)
  ├─ Captures: Time, Location (GPS)
  ├─ Photo/Selfie verification
  ├─ Status: shift_active
  └─ Notification sent to manager

10:00 AM - HOURLY OPERATIONS
  ├─ Hourly Plan created
  │  ├─ Assigned by manager
  │  ├─ Specific tasks/deliverables for the hour
  │  └─ Materials/tools required
  │
  ├─ Employee executes plan
  │  ├─ Progress tracking
  │  ├─ Material consumption
  │  └─ Quality checks
  │
  └─ Hourly Report submitted
     ├─ What was completed
     ├─ Challenges faced
     ├─ Materials used
     ├─ Next hour plan
     └─ Photo/selfie proof

(Repeat every hour)

12:00 PM - BREAK (15 mins)
  ├─ Manager creates break slot
  ├─ Employee marks start
  ├─ Employee marks end
  └─ System tracks duration

5:00 PM - SHIFT END
  ├─ Employee logs out (Shift Logout Page)
  ├─ End-of-day summary created
  │  ├─ Total work completed
  │  ├─ Issues faced
  │  ├─ Materials consumed
  │  ├─ Attendance marked
  │  └─ Approval from manager
  │
  └─ Shift record closed
```

**Real-Time Tracking Features**:
- GPS location tracking (every 30 minutes)
- Selfie verification (at start, during day, at end)
- Hourly work proof (photos/videos)
- Material consumption tracking
- Break duration monitoring
- Geofence validation (is employee at right location?)

**Accountability System**:
- If employee not at geofence → Flag & escalate
- If hourly report not submitted → Reminder, then escalation
- If suspicious activity → Fraud alert
- If excessive breaks → HR review

**Key Tables**:
- `shift_sessions` - Shift start/end records
- `hourly_plans` - Hourly work assignments
- `hourly_reports` - Hourly progress reports
- `shift_breaks` - Break tracking
- `location_tracking` - GPS coordinates
- `shift_eod` - End-of-day summaries

**Key Hooks**:
- `useShiftSession()` - Shift management
- `useHourlyPlans()` - Plan creation
- `useHourlyReports()` - Progress tracking
- `useShiftBreaks()` - Break management
- `useLocationTracking()` - GPS tracking
- `useShiftEOD()` - End-of-day

---

### 7. DAILY OPERATIONS MODULE

**Purpose**: Track day-to-day work activities and progress.

**Day Workflow** (For Site/Field Employees):

```
6:00 AM - DAY START
  ├─ Employee logs in (Day Start Page)
  ├─ Captures: Location, Status
  ├─ Day plan created by manager
  │  └─ High-level goals for the day
  └─ Confirmation submitted

9:00 AM onwards - DAILY EXECUTION
  ├─ Hourly Reports submitted (see Shift Module)
  └─ Daily Site Updates (photos/videos)
     ├─ Current progress
     ├─ Equipment on-site
     ├─ Material availability
     ├─ Challenges/blockers
     └─ Next day prep

6:00 PM - END-OF-DAY
  ├─ EOD Summary submitted (EOD Summary Page)
  │  ├─ Total accomplished
  │  ├─ Challenges faced
  │  ├─ Next day preparation
  │  ├─ Attendance mark
  │  └─ Photo proof
  │
  └─ Day record closed
```

**Day Plan System**:
```
Manager creates Day Plan (Day Before):
  ├─ Project/Work Order
  ├─ Specific tasks
  ├─ Expected deliverables
  ├─ Materials available
  └─ Success criteria

Employee executes:
  ├─ Follows plan
  ├─ Logs progress hourly
  ├─ Updates challenges
  └─ Suggests improvements

Manager reviews:
  ├─ Actual vs planned
  ├─ Quality assessment
  ├─ Approval/feedback
  └─ Performance rating
```

**Key Tables**:
- `day_plans` - Daily plan records
- `daily_site_updates` - Site progress photos/videos
- `eod_reports` - End-of-day summaries

**Key Hooks**:
- `useDayPlan()` - Day planning
- `useDailySiteUpdates()` - Site updates
- `useEODReport()` - End-of-day reporting

---

### 8. ESCALATION MANAGEMENT MODULE

**Purpose**: Handle issues and escalations across the organization.

**Escalation Types**:
1. **Operational** - Work delays, material shortage, equipment breakdown
2. **Financial** - Budget overrun, unauthorized expense, payment delay
3. **Compliance** - Policy violation, missing documentation, audit issue
4. **HR** - Attendance issue, performance concern, grievance
5. **Quality** - Defect, rework needed, standard deviation

**Escalation Workflow**:

```
Issue Identified
  └─ Any employee reports issue
     ├─ Issue type
     ├─ Severity (Low/Medium/High/Critical)
     ├─ Description with photos/videos
     └─ Suggested resolution

  ↓

Level 1 (Immediate Manager)
  ├─ Receive notification
  ├─ Acknowledge within 30 mins
  ├─ Review details
  └─ Resolution:
      ├─ RESOLVED: Close with notes
      └─ ESCALATE: Move to Level 2

  ↓ (if escalated)

Level 2 (Department Head/GM)
  ├─ Receive notification
  ├─ Acknowledge within 1 hour
  ├─ Investigation
  └─ Resolution:
      ├─ RESOLVED: Close with action taken
      └─ ESCALATE: Move to Level 3

  ↓ (if escalated)

Level 3 (CEO/Executive)
  ├─ Receive notification
  ├─ Full investigation
  ├─ Strategic decision
  └─ RESOLVED: Final decision with action items

  ↓

Follow-up & Closure
  ├─ Action items tracked
  ├─ Implementation verified
  ├─ Escalation closed
  └─ Learning documented
```

**Escalation SLAs** (Service Level Agreements):
- Critical: Acknowledge within 15 minutes, resolve within 2 hours
- High: Acknowledge within 1 hour, resolve within 8 hours
- Medium: Acknowledge within 4 hours, resolve within 24 hours
- Low: Acknowledge within 1 day, resolve within 1 week

**Escalation Analytics**:
- Escalation frequency by type
- Average resolution time
- Resolution success rate
- Escalated person recurring issues
- Department escalation patterns

**Key Tables**:
- `escalations` - Escalation records
- `escalation_comments` - Discussion thread
- `escalation_history` - Status changes
- `escalation_closure_reasons` - Resolution tracking

**Key Hooks**:
- `useEscalations()` - Escalation management
- `useEscalationEngine()` - Workflow engine
- `useRealtimeEscalations()` - Real-time updates

---

### 9. RENTAL MANAGEMENT MODULE

**Purpose**: Manage equipment and property rentals.

**Rental Lifecycle**:

```
Property Identification
  └─ Property details, location, capacity
     ├─ Historical rental data
     ├─ Maintenance schedule
     └─ Depreciation tracking

  ↓

Rental Request
  └─ Project requests equipment/property
     ├─ Duration needed
     ├─ Specific requirements
     └─ Budget allocation

  ↓

Availability Check
  └─ System checks availability
     ├─ If available: Reserve
     └─ If not available: Suggest alternatives

  ↓

Rental Agreement
  └─ Generate agreement
     ├─ Terms & conditions
     ├─ Payment terms
     ├─ Damage liability
     ├─ Insurance requirements
     └─ CEO approval (if threshold)

  ↓

Delivery & Setup
  └─ Deliver to site
     ├─ Condition verification
     ├─ Setup & commissioning
     └─ Operator training

  ↓

Usage & Monitoring
  └─ Track rental period
     ├─ Daily usage logs
     ├─ Maintenance checks
     ├─ Problem reporting
     └─ Extension requests

  ↓

Return & Settlement
  └─ Return at end of rental
     ├─ Condition assessment
     ├─ Damage evaluation
     ├─ Cleaning/repairs if needed
     ├─ Calculate final costs
     └─ Generate invoice

  ↓

Payment & Closure
  └─ Process payment
     ├─ Rental fees
     ├─ Additional charges (if any)
     ├─ Damage deductions (if any)
     └─ Final settlement
```

**Rental Portfolio Dashboard**:
- Total rental assets
- Current utilization rate
- Available assets for rental
- Upcoming expirations
- Revenue by rental type
- Maintenance due

**Key Tables**:
- `rental_properties` - Rental assets
- `rental_agreements` - Rental contracts
- `rental_usage` - Usage tracking
- `rental_payments` - Payment records

**Key Hooks**:
- `useRentalAccess()` - Access management

---

### 10. AGRICULTURAL OPERATIONS MODULE

**Purpose**: Manage farm operations and cultivation cycles.

**Cultivation Cycle Management**:

```
Cycle Planning
  ├─ Crop selection based on season
  ├─ Field allocation
  ├─ Budget planning
  ├─ Resource planning
  │  ├─ Seeds
  │  ├─ Fertilizers
  │  ├─ Pesticides
  │  └─ Labor
  └─ Timeline setting

  ↓

Planting Phase
  ├─ Soil preparation
  ├─ Seed procurement
  ├─ Sowing
  ├─ Irrigation setup
  └─ Initial monitoring

  ↓

Growing Phase (Duration: Weeks to Months)
  ├─ Daily farm logs
  │  ├─ Weather conditions
  │  ├─ Crop health status
  │  ├─ Disease/pest activity
  │  ├─ Irrigation status
  │  └─ Labor activities
  │
  ├─ Maintenance activities
  │  ├─ Weeding
  │  ├─ Fertilizer application
  │  ├─ Pest management
  │  └─ Irrigation
  │
  └─ Farm manager remarks
     ├─ Observations
     ├─ Issues identified
     ├─ Corrective actions taken
     └─ Next day plan

  ↓

Harvest Preparation
  ├─ Assess crop maturity
  ├─ Plan harvest timing
  ├─ Arrange labor
  └─ Arrange equipment

  ↓

Harvest Phase
  ├─ Execute harvest
  ├─ Record harvest quantities
  ├─ Quality grading
  ├─ Storage preparation
  └─ Generate harvest record

  ↓

Post-Harvest
  ├─ Storage management
  ├─ Market preparation
  ├─ Sales
  └─ Cycle closure & analytics

  ↓

Cycle Analysis
  ├─ Yield vs planned
  ├─ Cost vs budget
  ├─ Issues & lessons learned
  ├─ Resource efficiency
  └─ Plan for next cycle
```

**Key Metrics**:
- Yield per acre
- Cost per unit yield
- Crop health score
- Resource utilization
- Labor productivity
- Profitability

**Key Tables**:
- `cultivation_cycles` - Cycle records
- `daily_farm_logs` - Daily activities
- `harvest_records` - Harvest data
- `farm_manager_remarks` - Manager observations

**Key Hooks**:
- `useCultivationCycles()` - Cycle management
- `useDailyFarmLogs()` - Log management
- `useHarvestRecords()` - Harvest tracking
- `useFarmManagerRemarks()` - Remarks tracking

---

## DATABASE SCHEMA OVERVIEW

### Database Foundation

**Database System**: Supabase (PostgreSQL 14.1)
**Total Tables**: 100+
**Authentication**: JWT with Row-Level Security (RLS)

### Table Categories

#### A. USER & AUTHENTICATION (10+ tables)
```
profiles
├─ id (UUID, PK)
├─ email (unique)
├─ full_name
├─ department
├─ role
├─ is_active
├─ phone
└─ metadata (JSON)

user_roles
├─ id (UUID)
├─ user_id (FK → profiles)
├─ role_name
├─ assigned_at
└─ assigned_by

role_permissions
├─ role_id
├─ permission_code
├─ granted_at
└─ granted_by
```

#### B. PROJECT MANAGEMENT (15+ tables)
```
projects
├─ id (UUID)
├─ name
├─ code
├─ description
├─ vertical (category)
├─ budget
├─ start_date
├─ end_date
├─ status
├─ project_manager_id (FK)
└─ metadata

project_phases
├─ id
├─ project_id (FK)
├─ phase_name
├─ description
├─ budget
├─ start_date
├─ end_date
└─ status

project_milestones
├─ id
├─ phase_id (FK)
├─ milestone_name
├─ planned_date
├─ actual_date
└─ status

tasks
├─ id
├─ project_id (FK)
├─ title
├─ description
├─ priority
├─ status
├─ assigned_to (FK)
├─ due_date
└─ metadata
```

#### C. WORK ORDER MANAGEMENT (10+ tables)
```
work_orders
├─ id (UUID)
├─ wo_number (unique)
├─ project_id (FK)
├─ phase_id (FK)
├─ milestone_id (FK)
├─ approved_budget
├─ negotiated_amount
├─ vendor_id (FK)
├─ scope_description
├─ status (multi-stage)
├─ created_by (FK)
├─ smo_approved_by (FK)
├─ smo_approved_at
├─ gmo_approved_by (FK)
├─ gmo_approved_at
├─ admin_reviewed_by (FK)
├─ admin_reviewed_at
├─ ceo_approved_by (FK)
├─ ceo_approved_at
├─ on_ceo_hold (boolean)
├─ hold_reason
├─ execution_team (array)
├─ advance_paid_amount
├─ final_paid_amount
├─ completion_verified (boolean)
├─ verified_by (FK)
├─ completed_at
└─ metadata

work_order_payments
├─ id
├─ wo_id (FK)
├─ payment_type
├─ amount
├─ status
├─ paid_at
├─ vendor_receipt

work_order_audits
├─ id
├─ wo_id (FK)
├─ action_type
├─ actor_id (FK)
├─ details (JSON)
└─ timestamp
```

#### D. FINANCIAL MANAGEMENT (20+ tables)
```
payments
├─ id
├─ payment_number (unique)
├─ amount
├─ currency
├─ status
├─ type (salary, wo, petty_cash, transport, etc.)
├─ request_id (FK)
├─ approved_by (FK)
├─ executed_by (FK)
├─ paid_to
├─ payment_method (bank_transfer, check, cash, upi)
├─ bank_reference
├─ paid_at
└─ metadata

payment_requests
├─ id
├─ request_number
├─ amount
├─ type
├─ requested_by (FK)
├─ justification
├─ attachments (array)
├─ status (pending, approved, rejected, paid)
├─ created_at
└─ metadata

payment_tags
├─ id
├─ tag_name
├─ category
├─ color
└─ is_active

petty_cash_*
├─ Various tables for petty cash tracking
└─ (Advance requests, settlements, reimbursements)

reconciliation_*
├─ Various tables for reconciliation
├─ Bank reconciliation
├─ Vendor reconciliation
└─ Project reconciliation
```

#### E. HUMAN RESOURCES (15+ tables)
```
employees
├─ id (FK → profiles)
├─ employee_code (unique)
├─ first_name
├─ last_name
├─ designation
├─ department_id (FK)
├─ date_of_joining
├─ date_of_birth
├─ gender
├─ bank_account
├─ salary_structure_id (FK)
├─ manager_id (FK)
└─ metadata

salary_structures
├─ id
├─ employee_id (FK)
├─ basic_pay
├─ allowances (JSON)
├─ deductions (JSON)
├─ gross_salary
├─ net_salary
├─ effective_from
├─ metadata

payslips
├─ id
├─ employee_id (FK)
├─ month
├─ year
├─ gross_salary
├─ deductions
├─ net_pay
├─ generated_at
└─ metadata

leave_requests
├─ id
├─ employee_id (FK)
├─ type (casual, sick, personal, etc.)
├─ start_date
├─ end_date
├─ reason
├─ status (pending, approved, rejected)
├─ approved_by (FK)
└─ metadata

lop_entries
├─ id
├─ employee_id (FK)
├─ date
├─ reason (absent, late, early)
├─ lop_amount (0.5 or 1 day)
├─ reversal_requested
├─ reversal_reason
└─ reversal_status

attendance_*
├─ attendance_records
├─ day_start_logs
├─ day_end_logs
└─ attendance_daily
```

#### F. PROCUREMENT (15+ tables)
```
vendors
├─ id
├─ vendor_code (unique)
├─ company_name
├─ contact_person
├─ phone
├─ email
├─ category (material, labor, service)
├─ bank_account
├─ upi
├─ status (active, inactive, blacklist)
├─ onboarded_at
└─ metadata

vendor_quotes
├─ id
├─ vendor_id (FK)
├─ work_order_id (FK) [optional]
├─ material (if applicable)
├─ quantity
├─ unit_rate
├─ total_amount
├─ validity_period
├─ quote_date
└─ metadata

vendor_ratings
├─ id
├─ vendor_id (FK)
├─ rating_date
├─ quality_rating
├─ delivery_rating
├─ price_rating
├─ overall_score
└─ comments

purchase_orders
├─ id
├─ po_number (unique)
├─ vendor_id (FK)
├─ work_order_id (FK)
├─ items (array of {material, qty, rate})
├─ total_amount
├─ payment_terms
├─ delivery_date
├─ status
└─ metadata

material_deliveries
├─ id
├─ po_id (FK)
├─ delivery_date
├─ items_received (array)
├─ quality_check
├─ received_by (FK)
└─ metadata
```

#### G. SHIFT OPERATIONS (10+ tables)
```
shift_sessions
├─ id
├─ employee_id (FK)
├─ date
├─ login_time
├─ logout_time
├─ login_location (lat, lng)
├─ logout_location (lat, lng)
├─ status
└─ metadata

hourly_plans
├─ id
├─ employee_id (FK)
├─ shift_session_id (FK)
├─ hour_of_day
├─ planned_tasks (array)
├─ expected_deliverables
└─ materials_required

hourly_reports
├─ id
├─ employee_id (FK)
├─ shift_session_id (FK)
├─ hour_of_day
├─ completed_tasks (array)
├─ challenges_faced
├─ materials_used
├─ photo_proofs (array)
├─ submitted_at
└─ metadata

shift_breaks
├─ id
├─ employee_id (FK)
├─ shift_session_id (FK)
├─ break_start
├─ break_end
├─ duration_minutes
└─ approval_status

shift_eod
├─ id
├─ employee_id (FK)
├─ shift_session_id (FK)
├─ total_work_completed
├─ issues_faced
├─ next_day_prep
├─ attendance_marked
└─ photo_proof
```

#### H. DAILY OPERATIONS (8+ tables)
```
day_plans
├─ id
├─ employee_id (FK)
├─ date
├─ work_order_id (FK)
├─ planned_tasks (array)
├─ deliverables
├─ materials_available
├─ success_criteria
└─ created_by (FK)

daily_site_updates
├─ id
├─ project_id (FK)
├─ work_order_id (FK)
├─ date
├─ current_progress
├─ equipment_on_site (array)
├─ material_availability
├─ challenges
├─ next_day_prep
├─ photos (array)
├─ videos (array)
└─ submitted_by (FK)

eod_reports
├─ id
├─ employee_id (FK)
├─ date
├─ total_accomplished
├─ challenges_faced
├─ next_day_prep
├─ attendance_mark
├─ photo_proof
└─ approval_status
```

#### I. ESCALATIONS (8+ tables)
```
escalations
├─ id
├─ escalation_number (unique)
├─ escalation_type
├─ severity (critical, high, medium, low)
├─ reported_by (FK)
├─ description
├─ attachments (array)
├─ current_owner (FK)
├─ current_level (1, 2, 3, 4)
├─ status (open, in_progress, resolved, closed)
├─ created_at
├─ last_updated
└─ metadata

escalation_comments
├─ id
├─ escalation_id (FK)
├─ comment_text
├─ commented_by (FK)
├─ commented_at
└─ attachments

escalation_history
├─ id
├─ escalation_id (FK)
├─ from_level
├─ to_level
├─ escalated_by (FK)
├─ reason
├─ escalated_at
└─ metadata
```

#### J. AI & ANALYTICS (10+ tables)
```
ai_employee_scores
├─ id
├─ user_id (FK)
├─ date
├─ ai_score (0-100)
├─ plan_quality_score
├─ report_quality_score
├─ punctuality_score
├─ consistency_score
├─ ai_analysis (text)
└─ timestamp

ai_monthly_reports
├─ id
├─ month
├─ year
├─ avg_org_score
├─ executive_summary
├─ detailed_analysis
├─ strategic_concerns (JSON)
├─ strategic_recommendations (JSON)
├─ top_departments (JSON)
└─ generated_at

ai_nudges
├─ id
├─ user_id (FK)
├─ nudge_type
├─ message
├─ trigger_reason
├─ delivered_at
├─ read_at
└─ dismissed_at

ai_config
├─ id
├─ provider
├─ model_id
├─ api_key
├─ temperature
├─ is_active
└─ settings (JSON)
```

#### K. OTHER MODULES
- **Rental Management**: rental_properties, rental_agreements, rental_usage, rental_payments
- **Farm Operations**: cultivation_cycles, daily_farm_logs, harvest_records, farm_manager_remarks
- **Transport**: transport_expenses, transport_analytics, route_analysis
- **Audit**: audit_logs, admin_reviews, fraud_alerts
- **System**: announcements, notifications, settings, webhooks

---

## KEY FEATURES & CAPABILITIES

### 1. Real-Time Synchronization
- **WebSocket-based Updates**: Changes made by one user instantly appear to all other connected users
- **Supabase Subscriptions**: Automatic listening to specific tables/rows
- **Live Presence**: See who is currently viewing/editing specific records
- **Conflict Resolution**: Last-write-wins for simultaneous edits

### 2. Multi-Level Approval Workflows
- **Configurable Approval Chains**: Different approval levels based on amount/type
- **Parallel Approvals**: Some approvals can happen simultaneously
- **Sequential Approvals**: Some must happen in order
- **Approval History**: Complete audit trail of who approved what and when
- **Rejection Handling**: Requestor notified with reason, can resubmit

### 3. Complete Audit Trails
- **Immutable Logs**: Once logged, cannot be deleted or modified
- **All Changes Tracked**: Every create, update, delete operation logged
- **User Attribution**: Which user made which change
- **Timestamp**: Exact time of change
- **Change Details**: What specifically was changed (before/after values)
- **Compliance Reports**: Generate audit reports for compliance audits

### 4. Role-Based Access Control (RBAC)
- **15+ Distinct Roles**: Each with specific permissions
- **Granular Permissions**: Can grant permission at action level (view, create, edit, delete)
- **Row-Level Security**: PostgreSQL RLS policies restrict data access at database level
- **Field-Level Security**: Some fields hidden based on role
- **Dynamic Permissions**: Can change permissions without code deployment

### 5. Real-Time Geofencing
- **Location Verification**: Employee must be within geofence to mark attendance
- **GPS Tracking**: Continuous tracking during shift with ~30-minute intervals
- **Geofence Alerts**: Alert if employee leaves geofence without authorization
- **Route Tracking**: Record complete route taken during day
- **Analytics**: Analyze routes for optimization

### 6. AI-Driven Analytics
- **Employee Scoring**: AI analyzes work quality, punctuality, consistency, plan quality
- **Fraud Detection**: AI identifies suspicious patterns
- **Predictive Analytics**: Forecast project completion, resource needs
- **Performance Insights**: Generate actionable insights for managers
- **Nudges**: System sends behavioral nudges to improve performance
- **Monthly Reports**: Executive summaries with strategic recommendations

### 7. Attendance Verification with Biometrics
- **Selfie Verification**: Employee must submit selfie at start/end of day
- **GPS Verification**: Selfie location must match geofence
- **Time Verification**: Selfie timestamp must be at expected time
- **Face Recognition** (Optional): Can integrate facial recognition for enhanced security
- **Attendance Reports**: Daily, weekly, monthly attendance summaries

### 8. Fraud Detection System
- **Suspicious Pattern Detection**:
  - Multiple login locations simultaneously
  - Impossible travel times
  - Repeated absence patterns
  - Unusual payment requests
- **Fraud Alerts**: Automatically escalated to management
- **Investigation Tools**: Tools to investigate suspicious activities
- **Blacklist Management**: Can blacklist vendors/employees

### 9. Bulk Operations
- **Bulk Employee Operations**:
  - Bulk salary adjustments
  - Bulk leave approvals
  - Bulk attendance corrections
  - Bulk payslip generation
- **Bulk Payments**: Generate multiple payments at once
- **Bulk Exports**: Export large datasets to Excel/CSV

### 10. Data Export Capabilities
- **Excel Export**: Export any data grid to Excel with formatting
- **PDF Export**: Generate formatted PDF reports
- **Scheduled Exports**: Automatically email reports on schedule
- **Custom Formatting**: Control which columns to export, sorting, filtering

### 11. Notification System
- **Toast Notifications**: In-app notifications
- **Browser Notifications**: Desktop notifications
- **Email Notifications**: Email alerts for important events
- **SMS Notifications** (If configured): SMS alerts
- **Custom Sounds**: Alert sounds for different notification types
- **Escalation Notifications**: Progressively escalate if not acknowledged

### 12. Communication & Chat
- **In-App Chat**: Real-time messaging between users
- **Chat Overlays**: Floating chat windows
- **File Sharing**: Share files in chat
- **Chat History**: Search and retrieve past conversations
- **Notifications**: Be notified of new messages

### 13. Financial Controls
- **Budget Tracking**: Real-time budget utilization
- **Cost Analysis**: Track spend vs budget across projects
- **Payment Thresholds**: Automatic routing based on amount
- **Segregation of Duties**: Prevent any one person from controlling entire process
- **Cost Overrun Alerts**: Alert when project exceeds budget

### 14. Document Management
- **File Upload**: Support for various file types
- **Version Control**: Track different versions of documents
- **Access Control**: Control who can view/download documents
- **PDF Generation**: Generate PDFs of records/reports
- **Archive**: Move old documents to archive

### 15. Integration Capabilities
- **API Integration** (Future): RESTful APIs for third-party integration
- **Webhook Support**: Send notifications to external systems
- **Supabase Storage**: Store files in S3-compatible storage
- **Email Integration**: Send automated emails
- **SMS Integration** (Optional): Send SMS alerts

---

## DATA FLOW & INTEGRATION

### Standard Data Flow Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                             │
│  (Form submission, button click, dropdown selection)            │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  REACT COMPONENT                                │
│  (Renders UI, handles user events)                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│               CUSTOM REACT HOOK (useX)                          │
│  (Business logic, form validation, state management)            │
│                                                                  │
│  Example: useWorkOrders()                                       │
│  ├─ useQuery() - Fetch work orders from API                    │
│  ├─ useMutation() - Create/Update/Delete operations            │
│  ├─ useState() - Local state management                         │
│  └─ useEffect() - Real-time subscriptions                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│           SUPABASE CLIENT INSTANCE                              │
│  (Handles communication with backend)                           │
│                                                                  │
│  const { data, error } = await supabase                        │
│    .from('work_orders')                                         │
│    .select('*')                                                 │
│    .eq('id', workOrderId)                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              POSTGREST API                                      │
│  (Auto-generated REST API from PostgreSQL schema)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│           POSTGRESQL DATABASE                                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Row-Level Security (RLS) Policies                     │   │
│  │  ├─ Verify user has permission                         │   │
│  │  ├─ Verify row matches user's department/role         │   │
│  │  └─ Allow/Deny operation                               │   │
│  └──────────────────┬──────────────────────────────────────┘   │
│                    │                                             │
│  ┌──────────────────▼──────────────────────────────────────┐   │
│  │  Execute CRUD Operation                                │   │
│  │  ├─ SELECT, INSERT, UPDATE, DELETE                    │   │
│  │  └─ Triggers: Audit log entry, timestamp update      │   │
│  └──────────────────┬──────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│        REAL-TIME BROADCAST (if subscribed)                      │
│                                                                  │
│  Supabase sends WebSocket message to all connected clients:     │
│  {                                                               │
│    type: "INSERT|UPDATE|DELETE",                               │
│    table: "work_orders",                                        │
│    record: { id: "...", ... }                                   │
│  }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│        REACT QUERY CACHE UPDATE                                 │
│                                                                  │
│  const queryClient = useQueryClient();                          │
│  queryClient.invalidateQueries({ queryKey: ['work-orders'] })  │
│  // OR                                                           │
│  queryClient.setQueryData(['work-orders', id], newData)        │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│        COMPONENT RE-RENDER                                      │
│                                                                  │
│  React detects state change → Re-renders component              │
│  New data displayed to user                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────────┐
        │                         │                  │
    ┌───▼────┐           ┌───────▼────┐      ┌──────▼────┐
    │ Notify │           │  Business  │      │ Trigger   │
    │ Users  │           │  Logic     │      │ Workflows │
    └────────┘           └────────────┘      └───────────┘
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐         ┌───▼────┐
    │ Toast   │          │ Multi-  │         │ Audit  │
    │ Message │          │ Level   │         │ Log    │
    │         │          │ Approver│         │ Entry  │
    └─────────┘          └─────────┘         └────────┘
```

### Real-Time Subscription Pattern

```typescript
// In custom hook (e.g., useWorkOrders)

useEffect(() => {
  // Subscribe to work_orders table changes
  const subscription = supabase
    .channel('public:work_orders')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'work_orders' },
      (payload) => {
        // Handle INSERT, UPDATE, DELETE
        if (payload.eventType === 'INSERT') {
          // Add new work order to list
        } else if (payload.eventType === 'UPDATE') {
          // Update existing work order
        } else if (payload.eventType === 'DELETE') {
          // Remove work order from list
        }

        // Invalidate React Query cache
        queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(subscription)
  }
}, [queryClient])
```

### Approval Workflow Integration

```
User submits request (e.g., Work Order)
    ↓
System creates record in pending state
    ↓
Notification sent to first approver
    ↓
First approver reviews & approves/rejects
    ↓
If approved: Move to next approver
If rejected: Notify requestor
    ↓
... (repeat for each approval level)
    ↓
Final approval: Record marked as approved
    ↓
System triggers next workflow step
    ├─ If WO: Ready for vendor sourcing
    ├─ If Payment: Ready for execution
    └─ If Leave: Marked as approved
    ↓
Notification sent to relevant parties
    ↓
Audit log entry created
```

---

## APPROVAL WORKFLOWS

### 1. Work Order Approval Workflow

```
                       ┌────────────────┐
                       │ WO Created by  │
                       │   Engineer     │
                       └────────┬───────┘
                                │
                       ┌────────▼─────────┐
                       │  Pending SMO     │
                       │ (Technical Check)│
                       └────────┬─────────┘
                                │
                    ┌───────────┴──────────┐
                    │                      │
              ┌─────▼─────┐          ┌────▼────┐
              │ Approved  │          │ Rejected│
              └─────┬─────┘          └────┬────┘
                    │                     │
              ┌─────▼──────────┐     ┌────▼──────┐
              │ Pending GMO    │     │ Returned  │
              │(Budget Auth)   │     │to Engineer│
              └─────┬──────────┘     └───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼────┐          ┌────▼────┐
    │Approved │          │Rejected │
    └────┬────┘          └────┬────┘
         │                    │
    ┌────▼─────────────────────────┐
    │ Pending Vendor Sourcing      │
    │ (Procurement collects quotes)│
    └────┬────────────────────────┘
         │
    ┌────▼──────────────┐
    │ Pending Admin     │
    │ (Final review)    │
    └────┬──────────────┘
         │
    ┌────▼──────────────┐
    │ Pending CEO       │
    │ (Final approval)  │
    └────┬──────────────┘
         │
    ┌────┴────────────────┐
    │                     │
┌──▼───┐           ┌─────▼──┐
│CEO   │           │ CEO    │
│Hold  │           │Approved│
└──────┘           └────┬───┘
                        │
                   ┌────▼───────┐
                   │In Execution│
                   └────────────┘
```

### 2. Payment Approval Workflow

```
Employee/Manager creates Payment Request
    │
    ├─ Specify Amount
    ├─ Specify Category (Salary, WO, Petty Cash, etc.)
    ├─ Attach proofs
    └─ Submit
         │
         ▼
Department Head Review
    ├─ Check budget
    ├─ Check policy
    └─ Approve/Reject
         │
    ┌────┴────────┐
    │             │
 Reject      Approve
    │             │
    │         ┌───▼──────────┐
    │         │Finance Review│
    │         │              │
    │         ├─ Verify docs │
    │         ├─ Check amount│
    │         └─ Approve/Rej │
    │             │          │
    │          ┌──┴──────┐
    │          │         │
    │       Reject    Approve
    │          │         │
    │          │    ┌────▼──────────┐
    │          │    │ Auditor Review │
    │          │    │(if > threshold)│
    │          │    │ Approve/Reject │
    │          │    └────┬───────────┘
    │          │         │
    │          │    ┌────┴────┐
    │          │    │         │
    │          │  Reject   Approve
    │          │    │         │
    │          │    │    ┌────▼─────────┐
    │          │    │    │ CEO Approval  │
    │          │    │    │              │
    │          │    │    ├─ Final review│
    │          │    │    └─ Approve/Rej│
    │          │    │         │        │
    │          │    │    ┌────┴────┐
    │          │    │    │         │
    │          │    │  Reject   Approve
    │          │    │    │         │
    ▼          ▼    ▼    ▼         ▼
        Payment Rejected       Payment Approved
                                    │
                            ┌───────▼────────┐
                            │ Finance        │
                            │ Executes       │
                            │ Payment        │
                            └────────────────┘
```

### 3. Leave Request Approval Workflow

```
Employee requests leave
    ├─ Specify: Dates, Type (Casual/Sick/etc.)
    ├─ Provide reason
    └─ Submit
         │
         ▼
Manager Review
    ├─ Check: Is employee absent on those dates?
    ├─ Check: Available balance?
    ├─ Consider: Business impact
    └─ Approve/Reject
         │
    ┌────┴────────┐
    │             │
 Reject      Approve
    │             │
    │         ┌───▼──────────┐
    │         │HR Verification│
    │         │ (Final check) │
    │         └───┬───────────┘
    │             │
    │         ┌───┴────┐
    │         │         │
    │      Reject    Approve
    │         │         │
    ▼         ▼         ▼
    Leave Request Status Updated
         │
         ├─ If Approved:
         │  ├─ Mark dates on calendar
         │  ├─ Notify payroll (for no LOP)
         │  └─ Send confirmation to employee
         │
         └─ If Rejected:
            └─ Notify employee with reason
```

---

## APPENDICES

### Appendix A: 150+ Custom React Hooks Reference

**Project & Work Order Hooks**:
- `useProjects()` - Project CRUD and listing
- `useProjectPhases()` - Phase management
- `useMilestones()` - Milestone tracking
- `useProjectTimeline()` - Timeline management
- `useProjectHealth()` - Health monitoring
- `useWorkOrders()` - Work order lifecycle
- `useWorkOrderPayments()` - WO payment tracking
- `useWorkOrderAudits()` - WO audit trails
- `useProcurementTimeline()` - Procurement timeline

**Procurement Hooks**:
- `useVendorMaster()` - Vendor management
- `useVendorQuotes()` - Quote handling
- `useVendorSourcingQueue()` - Sourcing workflow
- `useVendorWorkRequests()` - Work request management
- `useVendorPerformance()` - Vendor ratings
- `usePurchaseOrders()` - PO management
- `useMaterialRequests()` - Material requisition
- `useMaterialDeliveries()` - Delivery tracking
- `usePaymentValidation()` - Payment checks

**Financial Hooks**:
- `usePaymentRequests()` - Payment requisitions
- `usePaymentTags()` - Payment categorization
- `usePettyCash()` - Petty cash management
- `usePettyCashReports()` - Petty cash reporting
- `useReconciliation()` - Reconciliation workflows
- `useConsumptionSummary()` - Cost summaries

**HR & Payroll Hooks**:
- `useLeaveRequests()` - Leave management
- `useLOPEntries()` - Loss of pay tracking
- `useWeeklyAchievements()` - Achievement tracking
- `useWeeklyTargets()` - Target management
- `useEmployeeActivity()` - Activity monitoring
- `useEmployeeWeeklyPerformance()` - Performance analysis
- `usePayees()` - Payee management

**Operations Hooks**:
- `useDayStart()` - Day start operations
- `useDayPlan()` - Daily planning
- `useHourlyPlans()` - Hourly planning
- `useHourlyReports()` - Hourly reporting
- `useEODReport()` - End-of-day reporting
- `useDailySiteUpdates()` - Site progress updates
- `useActivityReport()` - Activity summaries
- `useMonthlyReports()` - Monthly reporting

**Shift Operations Hooks**:
- `useShiftSession()` - Shift management
- `useShiftHourlySlots()` - Hourly slot management
- `useShiftBreaks()` - Break tracking
- `useShiftEOD()` - End-of-shift operations
- `useShiftUserStatus()` - User shift status
- `useSlotReminders()` - Shift reminders

**Location & Tracking Hooks**:
- `useLocationTracking()` - GPS tracking
- `useRouteGuardStatus()` - Route guard verification
- `useSelfieReminders()` - Selfie reminders

**Escalation Hooks**:
- `useEscalations()` - Escalation management
- `useEscalationEngine()` - Workflow engine
- `useRealtimeEscalations()` - Real-time updates
- `useClientEscalations()` - Client-side escalations
- `useSiteVisitEscalations()` - Site visit escalations

**AI & Intelligence Hooks**:
- `useAIEmployeeScores()` - AI scoring
- `useAINudges()` - AI nudges
- `useERPIntelligence()` - ERP analytics
- `useCEOIntelligence()` - CEO intelligence
- `useIntelligenceAI()` - AI intelligence
- `useWeeklyPredictions()` - Predictive analytics

**Data & Reporting Hooks**:
- `useEmployeeDataExport()` - Data export
- `useTransportAnalytics()` - Transport analytics
- `useUnifiedWorkAnalytics()` - Work analytics
- `useHighPriorityAlerts()` - Alert management
- `useFraudAlerts()` - Fraud detection
- `useMonitoringAlerts()` - System monitoring

**Other Specialized Hooks**:
- `useBOQ()`, `useBOQPipeline()`, `useBOQTemplates()` - BOQ management
- `useGMOData()`, `useSMOData()` - Department data
- `useRentalAccess()` - Rental management
- `useWeekOffAssignments()` - Week off management
- `useCoreHeads()` - Core head management
- `useTaskAssignments()` - Task assignment
- `usePresence()` - User presence
- `useConnectionMonitor()` - Connection monitoring
- `useWebRTC()` - Real-time communication

### Appendix B: Directory Structure

```
igogroup/
├── src/
│   ├── pages/                      # 120+ Page components
│   │   ├── admin/                 # Admin pages (30+)
│   │   ├── ceo/                   # CEO dashboards (10+)
│   │   ├── employee/              # Employee pages (12+)
│   │   ├── engineering/           # Engineering pages (6+)
│   │   ├── finance/               # Finance pages
│   │   ├── hr/                    # HR pages
│   │   ├── shift/                 # Shift pages (6+)
│   │   ├── gm/                    # GM pages
│   │   ├── gmo/                   # GMO pages
│   │   ├── smo/                   # SMO pages
│   │   ├── vendor/                # Vendor pages
│   │   ├── site/                  # Site manager pages
│   │   ├── farm/                  # Farm pages
│   │   ├── rentals/               # Rental pages
│   │   ├── accounts/              # Accounts pages
│   │   ├── auditor/               # Auditor pages
│   │   ├── ceo/                   # CEO pages
│   │   ├── boi/                   # BOI pages
│   │   ├── inventory/             # Inventory pages
│   │   ├── purchase/              # Purchase pages
│   │   ├── datateam/              # Data team pages
│   │   ├── director/              # Director pages
│   │   ├── nsm/                   # NSM pages
│   │   ├── shift/                 # Shift pages
│   │   ├── chat/                  # Chat pages
│   │   ├── shared/                # Shared pages
│   │   ├── public/                # Public pages
│   │   ├── core-head/             # Core head pages
│   │   └── ...
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── layout/                # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── AppLayout.tsx
│   │   │   └── ...
│   │   ├── ui/                    # Shadcn/UI components
│   │   ├── work-orders/           # WO components
│   │   ├── projects/              # Project components
│   │   ├── payment/               # Payment components
│   │   ├── escalations/           # Escalation components
│   │   └── ...
│   │
│   ├── hooks/                      # 150+ Custom React Hooks
│   │   ├── useWorkOrders.ts
│   │   ├── useProjects.ts
│   │   ├── usePaymentRequests.ts
│   │   ├── useLeaveRequests.ts
│   │   ├── useShiftSession.ts
│   │   └── ... (140+ more)
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts           # Supabase client initialization
│   │       └── types.ts            # Generated TypeScript types (350KB+)
│   │
│   ├── contexts/                   # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── ChatOverlayContext.tsx
│   │   └── ...
│   │
│   ├── services/                   # Business logic services
│   ├── utils/                      # Utility functions
│   ├── types/                      # Type definitions
│   ├── lib/                        # Library functions
│   │
│   ├── modules/
│   │   └── hr-payroll/             # HR & Payroll module
│   │       ├── pages/
│   │       ├── components/
│   │       └── ...
│   │
│   ├── App.tsx                     # Main app component
│   ├── main.tsx                    # Entry point
│   ├── index.css                   # Global styles
│   └── vite-env.d.ts               # Vite environment types
│
├── directives/                      # Business process documentation
│   └── 01_work_order_management.md
│
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config
├── tailwind.config.ts               # Tailwind config
└── .env.local                       # Environment variables
```

### Appendix C: Key Performance Metrics & Monitoring

**System KPIs**:
- **Page Load Time**: < 2 seconds
- **API Response Time**: < 500ms
- **Real-time Sync Latency**: < 1 second
- **Uptime**: 99.9%
- **Error Rate**: < 0.1%

**Business KPIs**:
- **Work Order Cycle Time**: From creation to completion
- **Payment Processing Time**: From request to execution
- **Approval Efficiency**: Average time at each approval level
- **Employee Performance**: AI score trends
- **Vendor Quality Score**: Material quality and delivery

### Appendix D: Security & Compliance

**Security Features**:
- **Authentication**: JWT tokens with Supabase Auth
- **Encryption**: TLS for data in transit
- **Row-Level Security**: PostgreSQL RLS policies
- **Password Policy**: Strong password requirements
- **Session Management**: Auto-logout after inactivity
- **Audit Logging**: Immutable audit trails
- **Data Backup**: Automatic daily backups

**Compliance**:
- **Financial Audit Trail**: Complete transaction history
- **Segregation of Duties**: Enforced at workflow level
- **Document Retention**: Policy-based retention
- **Data Privacy**: Employee data protected
- **Fraud Detection**: Automated suspicious activity detection

---

## CONCLUSION

IGO Group ERP is a comprehensive, enterprise-grade system designed to manage complex multi-department operations with strong financial controls, real-time tracking, and AI-driven insights. The system is built on modern, scalable technologies and provides a solid foundation for organizational growth.

This documentation provides a complete technical overview that can be shared with any AI system, developer, or stakeholder to understand the full scope, architecture, and capabilities of the system.

---

**Document Version**: 1.0
**Last Updated**: March 2026
**Total Pages**: Comprehensive (50,000+ words equivalent)
**Status**: Complete & Production-Ready
