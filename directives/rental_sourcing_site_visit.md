# Directive: Rental Sourcing — Site Visit Requisition Module
# IGO Chain ERP | New Module
# Version: 2.0

---

## CHANGELOG
- v1.0 — Initial directive.
- v2.0 — Role renamed from `sitevisit_head` to `site_visit_farm_manager`.
         Added Site Visit Daily Report format (replaces hourly reporting for
         this role). Added ITC data access restriction (SMO + CEO only).
- v2.1 — Clarified: Assigned Field Person IS the site_visit_farm_manager.
         No separate field personnel. FM accepts and conducts the visit themselves.

---

## 1. MODULE OVERVIEW

This module manages the full lifecycle of a site visit request raised by RSH
(Regional Service Head) for rental sourcing purposes. It introduces a new
`site_visit_farm_manager` role and a structured, SLA-driven workflow with four
independent compliance deadlines.

### Why This Module Exists
The rental sourcing pipeline requires physical site evaluations before a
property can be onboarded. Previously this was handled ad-hoc with no
tracking. This module creates a closed-loop, evidence-based process with
automatic SLA escalation.

---

## 2. ROLES INVOLVED

| Role | ID in System | Responsibility |
|------|-------------|----------------|
| RSH | `rsh` | Raises the site visit request |
| Site Visit SMO | `smo` | First-line review and forwarding |
| Site Visit Farm Manager | `site_visit_farm_manager` (NEW ROLE) | Accepts visit, conducts it themselves, uploads all deliverables |
| Admin | `admin` | Oversight, SLA breach alerts, closure authority |
| CEO | `ceo` | Final escalation layer; ITC data access |

### New Role: `site_visit_farm_manager`

- Add to `UserRole` type in `src/types/igo-chain.ts`
- Map in `AuthContext.tsx` via `mapRole()`:
  `'site_visit_farm_manager'` → `'site_visit_farm_manager'`
  Also map aliases: `'svfm'`, `'sitevisitfarmmanager'` → same
- Default landing route: `/site-visit-fm-dashboard`
- ITC data columns on `site_visit_daily_reports`: FM can INSERT but
  CANNOT SELECT ITC columns. Only SMO and CEO can read them (see Section 9).

---

## 3. COMPLETE STATUS FLOW

```
RSH fills form
    |
    v
[draft]
    |  RSH submits
    v
[submitted]  ─────────────────── Notify: SMO
    |  SMO reviews & forwards
    v
[smo_reviewed] ──────────────── SLA #1 CLOCK STARTS (+5 days: assign/accept)
    |  FM accepts and self-assigns
    v
[assigned] ──────────────────── Notify: RSH
    |  FM logs visit start
    v
[visit_in_progress]
    |  FM marks visit done (via daily report is_visit_complete)
    v
[visit_completed] ───────────── SLA #2 CLOCK STARTS (+2 days: report)
    |                            SLA #4 CLOCK STARTS (+10 days: soil/water)
    |  FM uploads site visit report
    v
[report_submitted] ─────────── SLA #3 CLOCK STARTS (+4 days: quotation)
    |  Quotation uploaded
    v
[quotation_submitted]
    |  Soil & water reports uploaded (parallel to quotation)
    v
[soil_water_submitted]
    |  Admin verifies all deliverables complete
    v
[closed]
```

Rule: `quotation_submitted` and `soil_water_submitted` are independent.
`closed` requires BOTH.

---

## 4. SLA FRAMEWORK

Four independent SLA clocks.

| SLA # | Name | Starts When | Deadline | Owner |
|-------|------|-------------|----------|-------|
| SLA-1 | Site Visit Allocation | `smo_reviewed_at` | +5 calendar days | Site Visit Farm Manager |
| SLA-2 | Site Visit Report | `visit_completed_at` | +2 calendar days | Site Visit Farm Manager |
| SLA-3 | Quotation Submission | `report_submitted_at` | +4 calendar days | Site Visit Farm Manager |
| SLA-4 | Soil & Water Reports | `visit_completed_at` | +10 calendar days | Site Visit Farm Manager |

### SLA Status States
- `pending` — Clock running, within deadline
- `at_risk` — Less than 20% time remaining
- `breached` — Deadline passed, deliverable not submitted
- `completed` — Submitted on time
- `completed_late` — Submitted after breach

### SLA Breach Escalation Chain
```
Breach detected by Edge Function (check-site-visit-sla, runs every 30 min)
    | Immediate
    v
Notify: Site Visit Farm Manager (push + in-app)
    | +4 hours unresolved
    v
Notify: SMO + Admin
    | +24 hours unresolved
    v
Notify: CEO — appears on CEO Fire-deck
    └── Audit log entry: SLA_BREACH recorded
```

---

## 5. RSH — REQUEST FORM SPECIFICATION

Route: `/site-visit-request/new`

### Required Fields

```typescript
interface SiteVisitRequest {
  id: string;                         // UUID
  request_number: string;             // Auto: SVR-YYYY-NNNN
  requester_id: string;               // FK → profiles.id (RSH)
  created_at: timestamp;

  // Location
  location_title: string;
  location_address: string;
  location_city: string;
  location_state: string;
  location_pincode: string;
  location_lat: number | null;
  location_lng: number | null;
  location_google_maps_url: string;   // Paste Google Maps share link

  // Client Details
  client_name: string;
  client_contact_name: string;
  client_phone: string;
  client_email: string | null;
  client_type: 'new' | 'existing' | 'vip';

  // Visit Parameters
  visit_category: 'commercial' | 'agricultural' | 'industrial' | 'residential';
  priority: 'standard' | 'urgent' | 'emergency';
  purpose_description: string;        // Min 50 chars, max 1000 chars
  special_instructions: string | null;
  reference_documents_url: string | null;

  // Deadlines
  requested_visit_deadline: date;     // When RSH needs physical visit done (min today+3)
  requested_by_rsh_deadline: date;    // Full cycle completion expectation

  // Status
  status: SiteVisitStatus;
  smo_reviewed_by: string | null;
  smo_reviewed_at: timestamp | null;
  smo_remarks: string | null;
  smo_rejection_reason: string | null;
}
```

### Form UX Rules
- `location_google_maps_url` — Auto-extracts lat/lng from pasted Maps link.
- `requested_visit_deadline` — Min: today + 3 days.
- `priority: 'emergency'` — Notifies SMO + Farm Manager immediately.
- No proof URL required from RSH.

---

## 6. SMO — REVIEW SCREEN

Route: `/dashboard/smo` → Tab: "Site Visits"

### SMO Actions
- **Forward to Farm Manager**: status → `smo_reviewed`, records `smo_reviewed_at`. SLA-1 clock starts.
- **Return to RSH**: status → `draft`, records `smo_rejection_reason`.
- Optional remarks on forward action.

### SMO ITC Access
SMO can view ALL ITC data columns on `site_visit_daily_reports`. Read-only.

---

## 7. SITE VISIT FARM MANAGER — DASHBOARD & ACTIONS

Route: `/site-visit-fm-dashboard`

### How It Works (Simplified)
FM sees `smo_reviewed` requests. They click "Accept" to self-assign.
Assignment creates a `site_visit_assignments` record where:
- `assigned_person_name` = FM's own name
- `assigned_person_user_id` = FM's own user ID
- `assigned_person_is_system_user` = true

After accepting, FM starts the visit, submits daily reports, marks complete,
then uploads the 3 deliverables.

---

## 8. SITE VISIT DAILY REPORT

Route: `/site-visit-daily-report/:assignmentId`

Mode B (single daily report) is the default.

### Daily Report Fields
See detailed TypeScript interface in the database schema section.

### Report Validation Rules
1. `login_time` must be strictly before `logout_time`.
2. Minimum 2 geotagged images.
3. `work_summary` minimum 100 characters.
4. If `is_visit_complete = true`: status → `visit_completed`, starts SLA-2 and SLA-4.

---

## 9. ITC DATA — ACCESS RESTRICTION

- `smo` and `ceo` can read ITC columns
- All other roles: ITC columns return NULL from the masking VIEW
- `site_visit_farm_manager` can INSERT ITC data (they collect it in the field)
- UI: ITC section not rendered in DOM for non-SMO/CEO roles

---

## 10. DELIVERABLES PANEL (Farm Manager)

After `visit_completed`, FM sees three upload slots:
1. Site Visit Report (SLA-2: deadline visit_completed_at + 2 days)
2. Quotation (SLA-3: deadline report_submitted_at + 4 days, LOCKED until report submitted)
3. Soil & Water Reports (SLA-4: deadline visit_completed_at + 10 days)

---

## 11. DATABASE SCHEMA

See migration SQL in `migrations/` folder for complete DDL.

Tables:
- `site_visit_requests`
- `site_visit_assignments`
- `site_visit_daily_reports` (raw — FM writes here)
- `site_visit_daily_reports_public` (VIEW — all reads go here)
- `site_visit_sla_tracking`
- `site_visit_timeline`

---

## 12. NOTIFICATIONS MAP

| Trigger | Notify | Message |
|---------|--------|---------|
| RSH submits | SMO | New site visit request SVR-XXXX from [RSH] — [Priority] |
| Emergency priority | SMO + Farm Manager | EMERGENCY: SVR-XXXX needs immediate action |
| SMO forwards | Farm Manager | New request pending acceptance — SVR-XXXX, [Location] |
| FM accepts | RSH | SVR-XXXX accepted by FM, expected visit [date] |
| Daily report submitted | Farm Manager | New daily report for SVR-XXXX, Day [N] |
| Visit completed | Farm Manager | SVR-XXXX visit complete. Report due [date] |
| SLA at risk | Farm Manager | SLA [#] at risk — SVR-XXXX. Less than 20% time left |
| SLA breach L1 | Farm Manager | BREACH: SLA [#] overdue — SVR-XXXX |
| SLA breach L2 (+4h) | SMO + Admin | SLA [#] breach unresolved — SVR-XXXX |
| SLA breach L3 (+24h) | CEO | Critical: SLA [#] still unresolved — SVR-XXXX |
| Report submitted | RSH | Site visit report ready — SVR-XXXX |
| Quotation submitted | RSH | Quotation uploaded — SVR-XXXX |
| Soil/Water submitted | RSH + Admin | All field reports received — SVR-XXXX |
| Closed | RSH | SVR-XXXX closed |

---

## 13. EDGE FUNCTION: `check-site-visit-sla`

- Cron: every 30 minutes, `verify_jwt = false`
- Reads `site_visit_sla_tracking` WHERE status IN ('pending','at_risk')
- For each record:
  - Compute `time_remaining = deadline_at - NOW()`
  - Compute `pct_remaining = time_remaining / (deadline_at - clock_start_at)`
  - If `pct_remaining < 0.20` AND status = 'pending': UPDATE to `at_risk`
  - If `time_remaining < 0` AND `completed_at IS NULL`: UPDATE to `breached`
  - On breach: check notification columns, send L1/L2/L3 per escalation chain

---

## 14. ROUTES

```typescript
/site-visit-request/new          — RSH only
/site-visit-request/my           — RSH only
/site-visit-fm-dashboard         — site_visit_farm_manager only
/site-visit-fm-dashboard/:id     — site_visit_farm_manager only
/site-visit-daily-report/:id     — site_visit_farm_manager only
```

---

## 15. OPEN EDGE CASES

1. Cancelled after assignment — notify FM by name.
2. Re-visit — new request with `parent_request_id` pointing to original.
3. Business-day SLA — deadline calculation skips Sundays and `company_calendar` holidays.
4. ITC data entry — FM can write; reading is SMO/CEO only.
5. Reporting mode — default is Mode B (single daily report per day).
