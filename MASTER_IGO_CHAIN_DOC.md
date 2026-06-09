# IGO Chain — The Master System Encyclopedia

> **Version**: 1.1 (Consolidated)
> **Last Updated**: February 18, 2026
> **Purpose**: The absolute single source of truth for the IGO Chain ERP. This document synthesizes all architecture, module-specific logic, security protocols, and operational workflows into one unified guide.

---

## 📑 Table of Contents

1.  **[Vision & Philosophy](#-vision--philosophy)**
2.  **[System Architecture](#-system-architecture)**
3.  **[Governance & RBAC](#-governance--rbac)**
4.  **[The Operational Engine (Daily Workflow)](#-the-operational-engine)**
5.  **[Module Deep-Dives](#-module-deep-dives)**
    *   [Financial: Payment & Approval System](#payment--approval-system)
    *   [Engineering & Project Lifecycle](#engineering--project-lifecycle)
    *   [Rental Management (v2)](#rental-management-v2)
    *   [Workforce: LOP, Leave & Discipline](#workforce-lop-leave--discipline)
    *   [Escalation & Critical War Room](#escalation--critical-war-room)
6.  **[Database & Security (The RLS Model)](#-database--security)**
7.  **[AI & Intelligence Layer](#-ai--intelligence-layer)**
8.  **[Development & Maintenance](#-development--maintenance)**

---

## 🎯 1. Vision & Philosophy

**IGO Chain** is a real-time **Governance Engine** designed to manage a multi-vertical conglomerate (Engineering, Agriculture, Supply Chain) through **Evidence-First Accountability**.

### Core Pillars
| Pillar | Implementation |
| :--- | :--- |
| **Immutability** | Data is locked upon submission. No retroactive "fixing." |
| **Proof URLs** | Mandatory Google Drive evidence for every expense, site update, and report. |
| **Management by Exception** | Dashboards (especially CEO/Admin) only highlight deviations, breaches, and holds. |
| **Automatic Discipline** | The system autonomously calculates LOP (Loss of Pay) based on compliance tracking. |

---

## 🏗️ 2. System Architecture

### Tech Stack
*   **Web**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui.
*   **Mobile**: React Native (Expo), Expo Router.
*   **Backend (BaaS)**: Supabase (Postgres, Auth, Edge Functions, Real-time).
*   **Data Flow**: TanStack React Query for state, WebSocket subscriptions for live alerts.

### High-Level Structure
```
igochain-main/
├── src/pages/        # Organized by Role (e.g., /ceo, /admin, /employee)
├── src/hooks/        # Domain-specific CRUD (usePayments, useEscalations)
├── supabase/         # Edge Functions (SLA Breaches, Auto-Absence)
└── mobile-app/       # Parallel Expo application
```

---

## 🛡️ 3. Governance & RBAC

The system employs a strict **22-role hierarchy**. Permissions are not just about "can see," but "at what step do they approve?"

### Key Roles
*   **CEO**: Strategic oversight, final approval on payments and LOP reversals.
*   **BOI (Board of Intelligence)**: The central audit node. Almost all workflows pass through BOI.
*   **Accounts**: Final execution and bank UTR (Unique Transaction Reference) entry.
*   **Employee**: The primary data source (Day Start, Hourly Reports).

### Role Normalization
All roles are mapped in `AuthContext.tsx` via `mapRole()` to ensure case-insensitive consistency (e.g., `data_team` → `datateam`).

---

## ⚙️ 4. The Operational Engine

### The 24-Hour Reporting Loop
1.  **Day Start (by 09:30 AM)**: Selfie + GPS Zone verification. Failure results in **Auto-Absence Lockout**.
2.  **Day Plan**: Tasks array with dependency mapping.
3.  **Hourly Reports**: 10 mandatory slots (09:30 - 19:30). Each requires a `proof_url`.
4.  **EOD Summary**: Completion % vs. Plan.

### The Discipline Algorithm
The system triggers LOP for:
*   **Time Trap**: Late report submission.
*   **Compliance Trap**: Missing selfie or report.
*   **Selfie Trap**: Missing lunch/evening verification.

---

## 📦 5. Module Deep-Dives

### Payment & Approval System
The most complex part of the system, handling millions in disbursement.
*   **Workflows**:
    *   *Engineering*: Requester → SMO → GMO → BOI → GM → Admin → CEO → Accounts (7 Tiers).
    *   *Agri*: Requester → SMO → BOI → Director → Admin → CEO → Accounts.
*   **Immutability**: Once a payment is "Admin Approved," it is visually locked for CEO review.
*   **Kotak Export**: Accounts can export Kotak Bank bulk files directly for processing.

### Engineering & Project Lifecycle
*   **BOQ (Bill of Quantities)**: Every project is broken into line items (Material, Labor, Equipment).
*   **Lifecycle Stages**: New Deal → Engineering Assigned → BOQ Submitted → BOQ Approved → Sourcing → Execution → Completed.
*   **Proofing**: Every phase completion requires `execution_proofs` (photos/videos).

### Rental Management (v2)
*   **Focus**: Standardized management of conglomerate properties.
*   **Logic**: Links to `rental_property_remarks` and department-specific payment cycles.
*   **Approvals**: HR → RSH → Admin → CEO → Accounts.

### Escalation & Critical War Room
*   **L1/L2/L3 Layers**: Tickets automatically promote based on SLA timers (e.g., 45m for Criticals).
*   **War Room**: The CEO and Admin dashboards play "Emergency Alerts" (audio) when high-level breaches occur.
*   **Closure Proof**: Admin must verify "Resolution Evidence" before a ticket is officially `closed`.

---

## 🔒 6. Database & Security

### The RLS (Row Level Security) Model
Every table is secured. Common patterns:
*   **Self-Access**: Employees can see their own reports.
*   **Role-Based Access**: `admin`, `ceo`, and `boi` roles have `SELECT` access across most operational tables.
*   **Immutable Write**: Update policies often prevent changing `status` back to a previous state (e.g., cannot move `paid` back to `pending`).

### Audit Logs (`audit_logs`)
Captured for every critical mutation. Stores:
*   `before_state` & `after_state` (JSONB snapshots).
*   `performed_by_name` and `performed_by_role`.

---

## 🧠 7. AI & Intelligence Layer

*   **Selfie Compliance**: AI analyzes selfie uploads for protocol adherence.
*   **Urgency Pattern Analysis**: Detects departments or employees "gaming" the system by overusing 'Emergency' payment status.
*   **SLA Prediction**: Edge functions predict potential project delays based on historical reporting gaps.

---

## 🛠️ 8. Development & Maintenance

### Troubleshooting Common Issues
1.  **Attendance Lockout**: If an employee is locked out, Admin must use `attendance_lock_overrides`.
2.  **Role Mismatch**: Check `AuthContext.tsx` if a new role isn't seeing the correct dashboard.
3.  **Edge Function Failures**: Check Supabase logs for `check-sla-breach` if escalations aren't promoting.

---
*End of Master Document*
